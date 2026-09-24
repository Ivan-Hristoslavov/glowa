"use client";

import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Radio,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { NewAppointmentDialog } from "@/components/admin/calendar/appointment-dialog";
import { BlockTimeDialog } from "@/components/admin/calendar/block-time-dialog";
import {
  useCalendarDrag,
  type DragPreview,
  type DragTarget,
} from "@/components/admin/calendar/use-calendar-drag";
import type {
  CalendarAppointment,
  CalendarBlock,
  CalendarLocation,
  CalendarService,
  CalendarStaff,
} from "@/components/admin/calendar/types";
import { EmptyState } from "@/components/common/empty-state";
import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import {
  moveAppointment,
  resizeAppointment,
  setAppointmentNotes,
  setAppointmentStatus,
} from "@/lib/actions/admin-appointments";
import { formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  addDaysToKey,
  dayOfWeekFromKey,
  instantFromZoned,
  keyToDate,
  zonedDateKey,
  zonedMinutes,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

const SLOT_MINUTES = 15;
/** Pixels per minute at each zoom step: an hour is 60, 90 or 120px tall. */
const ZOOM_LEVELS = [1, 1.5, 2] as const;
const DEFAULT_ZOOM = 1;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 20 * 60;
/** Past this many columns the header drops to a compact layout. */
const COMPACT_COLUMNS = 6;

type CalendarPrefs = { hidden: string[]; onlyWorking: boolean; zoom: number };

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** "Мария Петрова" -> "Мария П.", for narrow columns. */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : name;
}

/**
 * Side-by-side lanes for overlapping cards. In week view every stylist
 * shares one column per day, and without this a busy afternoon was a stack
 * of cards hiding each other. Each run of mutually overlapping cards is
 * split into as many lanes as it needs at its widest.
 */
function layoutLanes(items: Array<{ id: string; start: number; end: number }>) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed = new Map<string, { lane: number; lanes: number }>();
  let cluster: string[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  function close() {
    for (const id of cluster) {
      const entry = placed.get(id);
      if (entry) entry.lanes = laneEnds.length;
    }
    cluster = [];
    laneEnds = [];
  }

  for (const item of sorted) {
    if (item.start >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    placed.set(item.id, { lane, lanes: 1 });
    cluster.push(item.id);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  close();
  return placed;
}

type CalendarBoardProps = {
  businessId: string;
  timezone: string;
  locale: Locale;
  canManage: boolean;
  view: "day" | "week";
  dateKey: string;
  weekKeys: string[];
  staff: CalendarStaff[];
  services: CalendarService[];
  locations: CalendarLocation[];
  appointments: CalendarAppointment[];
  blocks: CalendarBlock[];
};

export function CalendarBoard({
  businessId,
  timezone,
  locale,
  canManage,
  view,
  dateKey,
  weekKeys,
  staff,
  services,
  locations,
  appointments,
  blocks,
}: CalendarBoardProps) {
  const t = useTranslations("admin.calendar");
  const common = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Per device, per salon: which colleagues are shown and how tall an hour
  // is. A ten-person salon rarely wants all ten columns on a tablet.
  const [prefs, setPrefs] = useState<CalendarPrefs>({
    hidden: [],
    onlyWorking: true,
    zoom: DEFAULT_ZOOM,
  });
  const prefsKey = `glowa.calendar.${businessId}`;
  // null until mounted: the server's clock is not the salon's screen.
  const [now, setNow] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  const [selected, setSelected] = useState<CalendarAppointment | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [newAppointment, setNewAppointment] = useState<{
    dateKey: string;
    minutes: number;
    staffProfileId: string;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const load = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(prefsKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<CalendarPrefs>;
          setPrefs((current) => ({
            hidden: Array.isArray(parsed.hidden) ? parsed.hidden : current.hidden,
            onlyWorking:
              typeof parsed.onlyWorking === "boolean" ? parsed.onlyWorking : current.onlyWorking,
            zoom:
              typeof parsed.zoom === "number" && parsed.zoom in ZOOM_LEVELS
                ? parsed.zoom
                : current.zoom,
          }));
        }
      } catch {
        // Private mode or blocked storage: the defaults are fine.
      }
      setNow(Date.now());
    }, 0);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(load);
      window.clearInterval(tick);
    };
  }, [prefsKey]);

  function updatePrefs(patch: Partial<CalendarPrefs>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(prefsKey, JSON.stringify(next));
      } catch {
        // Not persisted; still applied for this visit.
      }
      return next;
    });
  }

  const pxPerMinute = ZOOM_LEVELS[prefs.zoom] ?? ZOOM_LEVELS[DEFAULT_ZOOM];

  /**
   * Who gets a column. Hidden colleagues are left out; in day view, so is
   * anyone not working that day unless they still have a booking on it. If
   * the filters would leave nothing, everyone is shown rather than an empty
   * grid that looks broken.
   */
  const visibleStaff = useMemo(() => {
    const chosen = staff.filter((member) => !prefs.hidden.includes(member.id));
    const dow = dayOfWeekFromKey(dateKey);
    const working =
      view === "day" && prefs.onlyWorking
        ? chosen.filter(
            (member) =>
              member.hours.some((window) => window.dayOfWeek === dow) ||
              appointments.some(
                (appointment) =>
                  appointment.staffProfileId === member.id &&
                  appointment.status !== "cancelled" &&
                  zonedDateKey(new Date(appointment.startsAt), timezone) === dateKey,
              ),
          )
        : chosen;
    if (working.length > 0) return working;
    return chosen.length > 0 ? chosen : staff;
  }, [appointments, dateKey, prefs.hidden, prefs.onlyWorking, staff, timezone, view]);

  const visibleIds = useMemo(
    () => new Set(visibleStaff.map((member) => member.id)),
    [visibleStaff],
  );

  const days = useMemo(
    () => (view === "week" ? weekKeys : [dateKey]),
    [dateKey, view, weekKeys],
  );

  // The grid spans the widest working window in view, padded to whole hours.
  const [startMinutes, endMinutes] = useMemo(() => {
    const relevantDows = new Set(days.map(dayOfWeekFromKey));
    let min = DEFAULT_START;
    let max = DEFAULT_END;
    for (const member of visibleStaff) {
      for (const window of member.hours) {
        if (!relevantDows.has(window.dayOfWeek)) continue;
        min = Math.min(min, window.startMinutes);
        max = Math.max(max, window.endMinutes);
      }
    }
    for (const appointment of appointments) {
      min = Math.min(min, zonedMinutes(new Date(appointment.startsAt), timezone));
      max = Math.max(max, zonedMinutes(new Date(appointment.endsAt), timezone) || 24 * 60);
    }
    return [Math.floor(min / 60) * 60, Math.min(24 * 60, Math.ceil(max / 60) * 60)];
  }, [appointments, days, timezone, visibleStaff]);

  const totalMinutes = Math.max(endMinutes - startMinutes, 60);
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let minute = startMinutes; minute <= endMinutes; minute += 60) marks.push(minute);
    return marks;
  }, [endMinutes, startMinutes]);

  /**
   * Open where the day is: at "now" for today, at the first working hour
   * otherwise. Once per day, view and zoom - never while someone is scrolling.
   */
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || now === null) return;
    const key = `${view}:${dateKey}:${pxPerMinute}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;

    const today = zonedDateKey(new Date(now), timezone);
    let target: number;
    if (days.includes(today)) {
      target = (zonedMinutes(new Date(now), timezone) - startMinutes) * pxPerMinute - box.clientHeight / 3;
    } else {
      const dows = new Set(days.map(dayOfWeekFromKey));
      const opens = visibleStaff
        .flatMap((member) => member.hours)
        .filter((window) => dows.has(window.dayOfWeek))
        .map((window) => window.startMinutes);
      target = opens.length > 0 ? (Math.min(...opens) - startMinutes) * pxPerMinute - 16 : 0;
    }
    box.scrollTo({ top: Math.max(0, target) });
  }, [dateKey, days, now, pxPerMinute, startMinutes, timezone, view, visibleStaff]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }),
    [locale, timezone],
  );
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [locale],
  );

  // Live updates: the calendar is shared, so a change by a colleague must not
  // leave this screen stale. RLS applies to the subscription too.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`calendar:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${businessId}`,
        },
        () => router.refresh(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  function go(days: number) {
    const next = addDaysToKey(dateKey, days);
    router.push(`/dashboard/calendar?view=${view}&date=${next}`);
  }

  function setView(nextView: string) {
    router.push(`/dashboard/calendar?view=${nextView}&date=${dateKey}`);
  }

  function openCell(cellDateKey: string, minutes: number, staffProfileId: string) {
    if (!canManage) return;
    setNewAppointment({ dateKey: cellDateKey, minutes, staffProfileId });
    setCreateOpen(true);
  }

  /**
   * Called once, when the pointer is released. Moving and resizing are two
   * different writes: a move keeps the duration and may change stylist or day,
   * a resize only moves the end. Both can be refused by the exclusion
   * constraint, which is what stops a stylist being double-booked by a drag.
   */
  const commitDrag = useCallback(
    (next: DragPreview) => {
      if (!canManage) return;

      startTransition(async () => {
        const result =
          next.mode === "resize"
            ? await resizeAppointment({
                businessId,
                appointmentId: next.id,
                durationMinutes: next.durationMinutes,
              })
            : await moveAppointment({
                businessId,
                appointmentId: next.id,
                startsAt: instantFromZoned(
                  next.dateKey,
                  next.startMinutes,
                  timezone,
                ).toISOString(),
                staffProfileId: next.staffProfileId ?? undefined,
              });

        if (!result.ok) {
          toast.error(
            result.code === "overlap" ? t("errors.overlap") : t("errors.generic"),
          );
          // The optimistic preview is already gone; refresh puts the card back
          // where the database still has it.
          router.refresh();
          return;
        }

        toast.success(t("updated"));
        router.refresh();
      });
    },
    [businessId, canManage, router, t, timezone],
  );

  const { begin: beginDrag, preview: dragPreview, isDragging } = useCalendarDrag({
    pxPerMinute,
    snapMinutes: SLOT_MINUTES,
    minMinutes: startMinutes,
    maxMinutes: endMinutes,
    enabled: canManage,
    onCommit: commitDrag,
  });

  function changeStatus(
    appointment: CalendarAppointment,
    status: "confirmed" | "completed" | "no_show" | "cancelled",
  ) {
    startTransition(async () => {
      const result = await setAppointmentStatus({
        businessId,
        appointmentId: appointment.id,
        status,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("updated"));
      setSelected(null);
      router.refresh();
    });
  }

  function saveNotes(appointment: CalendarAppointment) {
    startTransition(async () => {
      const result = await setAppointmentNotes({
        businessId,
        appointmentId: appointment.id,
        internalNotes: notesDraft,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    });
  }

  if (staff.length === 0) {
    return <EmptyState icon={CalendarOff} title={t("noStaff")} body={t("noStaffBody")} />;
  }

  /** Columns are staff in day view and days in week view. */
  const columns =
    view === "day"
      ? visibleStaff.map((member) => ({
          id: member.id,
          label: member.displayName,
          color: member.color,
          dateKey,
          staffProfileId: member.id,
          dayOfWeek: dayOfWeekFromKey(dateKey),
        }))
      : days.map((day) => ({
          id: day,
          label: dayFormatter.format(keyToDate(day)),
          color: null as string | null,
          dateKey: day,
          staffProfileId: visibleStaff[0]?.id ?? staff[0].id,
          dayOfWeek: dayOfWeekFromKey(day),
        }));

  function appointmentsFor(column: (typeof columns)[number]) {
    return appointments.filter((appointment) => {
      const start = new Date(appointment.startsAt);
      if (zonedDateKey(start, timezone) !== column.dateKey) return false;
      if (view === "day") return appointment.staffProfileId === column.staffProfileId;
      // An appointment with no stylist belongs to the whole team.
      return appointment.staffProfileId === null || visibleIds.has(appointment.staffProfileId);
    });
  }

  function blocksFor(column: (typeof columns)[number]) {
    const inDay = blocks.filter((block) => {
      const start = new Date(block.startsAt);
      if (zonedDateKey(start, timezone) !== column.dateKey) return false;
      if (view === "day") return block.staffProfileId === column.staffProfileId;
      return visibleIds.has(block.staffProfileId);
    });
    if (view === "day") return inDay;
    // In week view one column holds the whole team, and a closure arrives as
    // one block per stylist; draw each stretch of blocked time once.
    const seen = new Set<string>();
    return inDay.filter((block) => {
      const key = `${block.startsAt}|${block.endsAt}|${block.reason ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function workingWindows(column: (typeof columns)[number]) {
    const members =
      view === "day"
        ? staff.filter((member) => member.id === column.staffProfileId)
        : visibleStaff;

    return members.flatMap((member) =>
      member.hours.filter((window) => window.dayOfWeek === column.dayOfWeek),
    );
  }

  /** Bookings, booked minutes and working minutes, for the column header. */
  function columnLoad(column: (typeof columns)[number]) {
    const live = appointmentsFor(column).filter(
      (appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show",
    );
    const booked = live.reduce(
      (sum, appointment) =>
        sum +
        (new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) /
          60000,
      0,
    );
    const working = workingWindows(column).reduce(
      (sum, window) => sum + window.endMinutes - window.startMinutes,
      0,
    );
    return { count: live.length, booked, working };
  }

  const hoursFormatter = new Intl.NumberFormat(localeHrefLang[locale], {
    maximumFractionDigits: 1,
  });
  const todayKey = now === null ? null : zonedDateKey(new Date(now), timezone);
  const nowMinutes = now === null ? null : zonedMinutes(new Date(now), timezone);
  const nowVisible =
    nowMinutes !== null &&
    todayKey !== null &&
    days.includes(todayKey) &&
    nowMinutes >= startMinutes &&
    nowMinutes <= endMinutes;
  const compact = columns.length > COMPACT_COLUMNS;
  // Shortened names, unless shortening makes two colleagues look the same.
  const compactLabels = new Map(
    visibleStaff.map((member) => {
      const short = shortName(member.displayName);
      const clash = visibleStaff.some(
        (other) => other.id !== member.id && shortName(other.displayName) === short,
      );
      return [member.id, clash ? member.displayName : short];
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => go(view === "week" ? -7 : -1)} aria-label={t("previous")}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => router.push(`/dashboard/calendar?view=${view}&date=${zonedDateKey(new Date(), timezone)}`)}>
            {t("today")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => go(view === "week" ? 7 : 1)} aria-label={t("next")}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <p className="font-heading text-lg">
          {view === "week"
            ? `${dayFormatter.format(keyToDate(days[0]))} – ${dayFormatter.format(keyToDate(days[days.length - 1]))}`
            : dayFormatter.format(keyToDate(dateKey))}
        </p>

        <Tabs value={view} onValueChange={setView} className="ml-auto">
          <TabsList>
            <TabsTrigger value="day">{t("day")}</TabsTrigger>
            <TabsTrigger value="week">{t("week")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Users className="size-4" aria-hidden />
              {t("team")}
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs tabular-nums">
                {t("teamShown", { shown: visibleStaff.length, total: staff.length })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            {view === "day" ? (
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <Label htmlFor="calendar-only-working" className="text-sm font-normal">
                  {t("onlyWorking")}
                </Label>
                <Switch
                  id="calendar-only-working"
                  checked={prefs.onlyWorking}
                  onCheckedChange={(checked) => updatePrefs({ onlyWorking: checked })}
                />
              </div>
            ) : null}
            <ul className="max-h-72 overflow-y-auto py-1">
              {staff.map((member) => {
                const checked = !prefs.hidden.includes(member.id);
                const id = `calendar-staff-${member.id}`;
                return (
                  <li key={member.id}>
                    <label
                      htmlFor={id}
                      className="hover:bg-accent/60 flex cursor-pointer items-center gap-3 px-4 py-2"
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(value) =>
                          updatePrefs({
                            hidden:
                              value === true
                                ? prefs.hidden.filter((hiddenId) => hiddenId !== member.id)
                                : [...prefs.hidden, member.id],
                          })
                        }
                      />
                      <Avatar className="size-6">
                        {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                        <AvatarFallback
                          className="text-[0.65rem] font-medium text-white"
                          style={{ backgroundColor: member.color }}
                        >
                          {initials(member.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{member.displayName}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {prefs.hidden.length > 0 ? (
              <div className="border-t px-4 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => updatePrefs({ hidden: [] })}
                >
                  {t("showAll")}
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon"
            className="rounded-r-none"
            onClick={() => updatePrefs({ zoom: Math.max(0, prefs.zoom - 1) })}
            disabled={prefs.zoom === 0}
            aria-label={t("zoomOut")}
          >
            <ZoomOut className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="-ml-px rounded-l-none"
            onClick={() => updatePrefs({ zoom: Math.min(ZOOM_LEVELS.length - 1, prefs.zoom + 1) })}
            disabled={prefs.zoom === ZOOM_LEVELS.length - 1}
            aria-label={t("zoomIn")}
          >
            <ZoomIn className="size-4" aria-hidden />
          </Button>
        </div>

        {/* The labels used to disappear below `sm`, leaving a bare plus and a
            crossed-out calendar on the device a salon actually runs its day
            on. Two icons with no words is a guessing game, so the buttons
            keep their text and share the row instead. */}
        {canManage ? (
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setBlockOpen(true)}
            >
              <CalendarOff className="size-4" aria-hidden />
              {t("blockTime")}
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => {
                setNewAppointment({
                  dateKey,
                  minutes: 9 * 60,
                  staffProfileId: visibleStaff[0]?.id ?? staff[0].id,
                });
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("newAppointment")}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Radio className={cn("size-3.5", live ? "text-success" : "opacity-40")} aria-hidden />
        {t("liveHint")}
        {isPending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      </p>

      {/*
        One scroll box for both axes, so the team row can stick to its top
        and the hours to its left. With the page as the vertical scroller
        the header scrolled away, and the "now" line ran through the names.
        Stacking: time column 40 > team row 30 > now line 10 > cards.
      */}
      <div
        ref={scrollRef}
        className="glowa-card relative snap-x scroll-pl-14 overflow-auto overscroll-contain"
        style={{ maxHeight: "calc(100dvh - 15rem)", minHeight: "24rem" }}
      >
        <div className="flex min-w-max">
          {/* Time gutter */}
          <div className="border-border/70 bg-card sticky left-0 z-40 w-14 shrink-0 border-r">
            <div className="border-border/70 bg-card sticky top-0 z-10 h-16 border-b" />
            <div className="relative" style={{ height: totalMinutes * pxPerMinute }}>
              {hourMarks.map((minute) => (
                <span
                  key={minute}
                  className={cn(
                    "text-muted-foreground absolute right-2 -translate-y-1/2 text-[0.7rem] tabular-nums",
                    // The "now" label takes this spot.
                    nowVisible &&
                      nowMinutes !== null &&
                      Math.abs(nowMinutes - minute) * pxPerMinute < 14 &&
                      "invisible",
                  )}
                  style={{ top: (minute - startMinutes) * pxPerMinute }}
                >
                  {String(Math.floor(minute / 60)).padStart(2, "0")}:00
                </span>
              ))}
              {nowVisible && nowMinutes !== null ? (
                <span
                  className="bg-primary text-primary-foreground absolute right-1 z-10 -translate-y-1/2 rounded px-1 py-px text-[0.65rem] font-semibold tabular-nums shadow-sm"
                  style={{ top: (nowMinutes - startMinutes) * pxPerMinute }}
                >
                  {timeFormatter.format(new Date(now ?? 0))}
                </span>
              ) : null}
            </div>
          </div>

          {columns.map((column, columnIndex) => {
            const windows = workingWindows(column);
            const load = columnLoad(column);
            const member =
              view === "day" ? staff.find((person) => person.id === column.staffProfileId) : null;
            const isToday = column.dateKey === todayKey;
            const percent =
              load.working > 0 ? Math.min(100, Math.round((load.booked / load.working) * 100)) : 0;
            return (
              <div
                key={column.id}
                className={cn(
                  "border-border/70 flex-1 snap-start border-r last:border-r-0",
                  view === "week"
                    ? "min-w-[8.5rem]"
                    : compact
                      ? "min-w-[8.75rem] sm:min-w-[9.5rem]"
                      : "min-w-[9.5rem] sm:min-w-[11rem]",
                )}
              >
                <div
                  className={cn(
                    "border-border/70 bg-card sticky top-0 z-30 flex h-16 flex-col justify-center gap-1.5 border-b px-2.5",
                    windows.length === 0 && "opacity-70",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {member ? (
                      <Avatar
                        className="size-8 shrink-0"
                        style={{ boxShadow: `0 0 0 2px var(--card), 0 0 0 3.5px ${member.color}` }}
                      >
                        {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                        <AvatarFallback
                          className="text-xs font-medium text-white"
                          style={{ backgroundColor: member.color }}
                        >
                          {initials(member.displayName)}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm leading-tight font-medium",
                          view === "week" && isToday && "text-primary",
                        )}
                        title={column.label}
                      >
                        {compact && member ? compactLabels.get(member.id) ?? column.label : column.label}
                      </p>
                      <p className="text-muted-foreground truncate text-[0.7rem] leading-tight tabular-nums">
                        {windows.length === 0
                          ? t("dayOff")
                          : load.count === 0
                            ? t("free")
                            : `${t("bookings", { count: load.count })} · ${t("bookedHours", {
                                hours: hoursFormatter.format(load.booked / 60),
                              })}`}
                      </p>
                    </div>
                  </div>
                  {windows.length > 0 ? (
                    <div
                      className="bg-muted h-1 overflow-hidden rounded-full"
                      role="img"
                      aria-label={t("loadLabel", { percent })}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: member?.color ?? "var(--primary)",
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div
                  className="relative"
                  style={{ height: totalMinutes * pxPerMinute }}
                  // Read back by the drag hook from the pointer position, so
                  // dropping onto another stylist or another day just works.
                  data-calendar-column="1"
                  data-calendar-date={column.dateKey}
                  data-calendar-staff={column.staffProfileId}
                >
                  {/* Closed time is hatched, so an empty column reads as
                      "closed" rather than "free". */}
                  {windows.length === 0 ? (
                    <div className="glowa-closed absolute inset-0" aria-hidden />
                  ) : (
                    <>
                      <div className="glowa-closed absolute inset-x-0 top-0" style={{ height: Math.max(0, (Math.min(...windows.map((w) => w.startMinutes)) - startMinutes) * pxPerMinute) }} aria-hidden />
                      <div className="glowa-closed absolute inset-x-0 bottom-0" style={{ height: Math.max(0, (endMinutes - Math.max(...windows.map((w) => w.endMinutes))) * pxPerMinute) }} aria-hidden />
                    </>
                  )}

                  {hourMarks.map((minute) => (
                    <div
                      key={minute}
                      className="border-border/50 absolute inset-x-0 border-t"
                      style={{ top: (minute - startMinutes) * pxPerMinute }}
                      aria-hidden
                    />
                  ))}
                  {pxPerMinute >= 1.5
                    ? hourMarks.map((minute) => (
                        <div
                          key={`half-${minute}`}
                          className="border-border/25 absolute inset-x-0 border-t border-dashed"
                          style={{ top: (minute + 30 - startMinutes) * pxPerMinute }}
                          aria-hidden
                        />
                      ))
                    : null}

                  {/* Drop / create targets, one per slot. */}
                  {Array.from(
                    { length: Math.ceil(totalMinutes / SLOT_MINUTES) },
                    (_, index) => startMinutes + index * SLOT_MINUTES,
                  ).map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      tabIndex={-1}
                      aria-hidden
                      className="hover:bg-accent/40 absolute inset-x-0 cursor-pointer"
                      style={{
                        top: (minute - startMinutes) * pxPerMinute,
                        height: SLOT_MINUTES * pxPerMinute,
                      }}
                      onClick={() => {
                        // A drag that ended over this cell must not also open
                        // the "new appointment" dialog.
                        if (isDragging) return;
                        openCell(column.dateKey, minute, column.staffProfileId);
                      }}
                    />
                  ))}

                  {blocksFor(column).map((block) => {
                    const top = (zonedMinutes(new Date(block.startsAt), timezone) - startMinutes) * pxPerMinute;
                    const height =
                      ((new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) / 60000) *
                      pxPerMinute;
                    return (
                      <div
                        key={block.id}
                        className="glowa-closed border-border text-muted-foreground absolute inset-x-1 overflow-hidden rounded-md border border-dashed px-2 py-1 text-[0.7rem]"
                        style={{ top, height: Math.max(height, 18) }}
                      >
                        <span className="bg-card/80 rounded px-1">{block.reason || t("blockedLabel")}</span>
                      </div>
                    );
                  })}

                  {(() => {
                    const list = appointmentsFor(column);
                    const lanes = layoutLanes(
                      list.map((appointment) => {
                        const ghost = dragPreview?.id === appointment.id ? dragPreview : null;
                        const start = ghost
                          ? ghost.startMinutes
                          : zonedMinutes(new Date(appointment.startsAt), timezone);
                        const duration = ghost
                          ? ghost.durationMinutes
                          : (new Date(appointment.endsAt).getTime() -
                              new Date(appointment.startsAt).getTime()) /
                            60000;
                        return { id: appointment.id, start, end: start + Math.max(duration, 15) };
                      }),
                    );
                    return list.map((appointment) => {
                      const place = lanes.get(appointment.id) ?? { lane: 0, lanes: 1 };
                      const originStart = zonedMinutes(
                        new Date(appointment.startsAt),
                        timezone,
                      );
                      const originDuration =
                        (new Date(appointment.endsAt).getTime() -
                          new Date(appointment.startsAt).getTime()) /
                        60000;

                      // While this card is being dragged it follows the pointer
                      // rather than the database.
                      const isGhost = dragPreview?.id === appointment.id;
                      const shownStart = isGhost ? dragPreview.startMinutes : originStart;
                      const shownDuration = isGhost
                        ? dragPreview.durationMinutes
                        : originDuration;

                      // A move can carry the card into another column; it is
                      // drawn there and hidden here.
                      const movedAway =
                        isGhost &&
                        dragPreview.mode === "move" &&
                        (dragPreview.dateKey !== column.dateKey ||
                          dragPreview.staffProfileId !== column.staffProfileId);
                      if (movedAway) return null;

                      const top = (shownStart - startMinutes) * pxPerMinute;
                      const height = Math.max(shownDuration * pxPerMinute, 22);
                      const owner = staff.find((s) => s.id === appointment.staffProfileId);
                      const color = owner?.color ?? "#D96C61";
                      const isCancelled =
                        appointment.status === "cancelled" || appointment.status === "no_show";
                      const isUnconfirmed = appointment.status === "pending";
                      const draggable = canManage && !isCancelled;
                      const shownFrom = isGhost
                        ? instantFromZoned(dragPreview.dateKey, shownStart, timezone)
                        : new Date(appointment.startsAt);
                      const shownTo = new Date(shownFrom.getTime() + shownDuration * 60000);
                      // Three or more side by side is too narrow for words:
                      // the stylist's initial and the hour, details on hover
                      // and in the sheet.
                      const narrow = place.lanes >= 3;
                      const summary = [
                        `${timeFormatter.format(shownFrom)}–${timeFormatter.format(shownTo)}`,
                        appointment.customerName,
                        appointment.serviceName,
                        owner?.displayName,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      const target: DragTarget = {
                        id: appointment.id,
                        startMinutes: originStart,
                        durationMinutes: originDuration,
                        dateKey: column.dateKey,
                        staffProfileId: column.staffProfileId,
                      };

                      return (
                        <div
                          key={appointment.id}
                          className={cn(
                            "absolute overflow-hidden rounded-md border border-l-[3px] text-[0.72rem] leading-tight shadow-sm transition-shadow hover:z-[15] hover:shadow-md",
                            isCancelled && "opacity-50",
                            isUnconfirmed && "border-dashed",
                            isGhost && "z-20 shadow-lg ring-2 ring-primary/60",
                          )}
                          style={{
                            top,
                            height,
                            left: `calc(${(place.lane / place.lanes) * 100}% + 4px)`,
                            width: `calc(${100 / place.lanes}% - ${place.lanes > 1 ? 5 : 8}px)`,
                            backgroundColor: `color-mix(in oklab, ${color} 14%, var(--card))`,
                            borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
                            borderLeftColor: color,
                            // Without this the browser scrolls the page instead
                            // of letting the finger drag the card.
                            touchAction: draggable ? "none" : undefined,
                          }}
                        >
                          <button
                            type="button"
                            onPointerDown={(event) =>
                              draggable && beginDrag(event, "move", target)
                            }
                            onClick={() => {
                              if (isDragging) return;
                              setSelected(appointment);
                              setNotesDraft(appointment.internalNotes ?? "");
                            }}
                            title={summary}
                            aria-label={summary}
                            className={cn(
                              "glowa-focus block size-full overflow-hidden text-left",
                              narrow ? "px-0.5 py-1" : "px-2 py-1",
                              draggable && "cursor-grab active:cursor-grabbing",
                              isCancelled && "line-through",
                            )}
                          >
                            {narrow ? (
                              <span className="flex flex-col items-center gap-0.5">
                                <span
                                  className="flex size-4 items-center justify-center rounded-full text-[0.6rem] font-semibold text-white"
                                  style={{ backgroundColor: color }}
                                  aria-hidden
                                >
                                  {initials(owner?.displayName ?? appointment.customerName ?? "")}
                                </span>
                                <span className="text-[0.6rem] tabular-nums" aria-hidden>
                                  {timeFormatter.format(shownFrom).slice(0, 5)}
                                </span>
                              </span>
                            ) : height < 36 ? (
                              <span className="block truncate">
                                <span className="font-semibold tabular-nums">
                                  {timeFormatter.format(shownFrom)}
                                </span>{" "}
                                {appointment.customerName ?? appointment.serviceName}
                              </span>
                            ) : (
                              <>
                                <span className="text-muted-foreground block truncate text-[0.68rem] tabular-nums">
                                  {timeFormatter.format(shownFrom)}–{timeFormatter.format(shownTo)}
                                </span>
                                <span className="block truncate font-semibold">
                                  {appointment.customerName ?? "—"}
                                </span>
                                <span className="text-muted-foreground block truncate">
                                  {appointment.serviceName}
                                </span>
                              </>
                            )}
                          </button>

                          {/* Bottom edge: drag to change how long it takes. */}
                          {draggable ? (
                            <span
                              role="presentation"
                              onPointerDown={(event) =>
                                beginDrag(event, "resize", target)
                              }
                              className="hover:bg-primary/40 absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                              style={{ touchAction: "none" }}
                            />
                          ) : null}
                        </div>
                      );
                    });
                  })()}

                  {/* A card dragged in from another column is drawn here. */}
                  {dragPreview &&
                  dragPreview.mode === "move" &&
                  dragPreview.dateKey === column.dateKey &&
                  dragPreview.staffProfileId === column.staffProfileId &&
                  !appointmentsFor(column).some((a) => a.id === dragPreview.id) ? (
                    <div
                      aria-hidden
                      className="border-primary bg-primary/20 pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed"
                      style={{
                        top: (dragPreview.startMinutes - startMinutes) * pxPerMinute,
                        height: Math.max(dragPreview.durationMinutes * pxPerMinute, 22),
                      }}
                    />
                  ) : null}

                  {/* Now: under the team row (z-30), above the cards. */}
                  {nowVisible && nowMinutes !== null && isToday ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-10"
                      style={{ top: (nowMinutes - startMinutes) * pxPerMinute }}
                    >
                      <div className="bg-primary h-0.5 w-full shadow-[0_0_6px_var(--primary)]" />
                      {columnIndex === 0 || view === "week" ? (
                        <span className="bg-primary absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full" />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.serviceName}</SheetTitle>
                <SheetDescription>
                  {timeFormatter.format(new Date(selected.startsAt))} –{" "}
                  {timeFormatter.format(new Date(selected.endsAt))}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <AppointmentStatusBadge status={selected.status} />
                  <span className="text-muted-foreground text-sm">
                    {formatPrice(selected.priceCents, selected.currency, locale)}
                  </span>
                </div>

                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("customer")}</dt>
                    <dd>{selected.customerName ?? "—"}</dd>
                  </div>
                  {selected.customerNotes ? (
                    <div>
                      <dt className="text-muted-foreground text-xs">{t("customerNotes")}</dt>
                      <dd className="whitespace-pre-line">{selected.customerNotes}</dd>
                    </div>
                  ) : null}
                </dl>

                <Separator />

                <div className="space-y-2">
                  <label htmlFor="sheet-notes" className="text-sm font-medium">
                    {t("internalNotes")}
                  </label>
                  <Textarea
                    id="sheet-notes"
                    rows={3}
                    maxLength={2000}
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveNotes(selected)}
                    disabled={isPending}
                  >
                    {common("save")}
                  </Button>
                </div>

                {canManage ? (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      {selected.status === "pending" ? (
                        <Button size="sm" onClick={() => changeStatus(selected, "confirmed")} disabled={isPending}>
                          {t("markConfirmed")}
                        </Button>
                      ) : null}
                      {selected.status !== "completed" ? (
                        <Button size="sm" variant="outline" onClick={() => changeStatus(selected, "completed")} disabled={isPending}>
                          {t("markCompleted")}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => changeStatus(selected, "no_show")} disabled={isPending}>
                        {t("markNoShow")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => changeStatus(selected, "cancelled")}
                        disabled={isPending}
                      >
                        {t("cancelAppointment")}
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <NewAppointmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        businessId={businessId}
        timezone={timezone}
        locations={locations}
        services={services}
        staff={staff}
        initial={newAppointment}
      />

      <BlockTimeDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        businessId={businessId}
        timezone={timezone}
        staff={staff}
        defaultDateKey={dateKey}
      />
    </div>
  );
}
