"use client";

import {
  CalendarOff,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Loader2,
  Lock,
  Phone,
  Plus,
  Radio,
  ShieldCheck,
  StickyNote,
  UserRound,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { bg, enGB, ro } from "react-day-picker/locale";
import { toast } from "sonner";

import { NewAppointmentDialog } from "@/components/admin/calendar/appointment-dialog";
import { BlockTimeDialog } from "@/components/admin/calendar/block-time-dialog";
import {
  useCalendarDrag,
  type DragPreview,
  type DragTarget,
} from "@/components/admin/calendar/use-calendar-drag";
import { layoutLanes, staffTracks } from "@/components/admin/calendar/lanes";
import type {
  CalendarAppointment,
  CalendarBlock,
  CalendarLocation,
  CalendarService,
  CalendarStaff,
  DepositStatus,
} from "@/components/admin/calendar/types";
import { EmptyState } from "@/components/common/empty-state";
import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  startOfWeekKey,
  zonedDateKey,
  zonedMinutes,
} from "@/lib/timezone";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

const SLOT_MINUTES = 15;
/**
 * 120px an hour: a 30-minute visit shows its time, service and client without
 * being opened, and a 15-minute slot is still a comfortable tap target.
 */
const PX_PER_MINUTE = 2;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 20 * 60;
const FALLBACK_COLOR = "#D96C61";

/** Deposit states in which the salon is holding the client's money. */
const SECURED: ReadonlySet<DepositStatus> = new Set(["paid", "applied", "retained"]);

const PICKER_LOCALES = { bg, en: enGB, ro } as const;

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
  /** Opened from "New appointment" elsewhere in the admin. */
  openNew?: boolean;
};

function minutesLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A local calendar date for the picker, from a `YYYY-MM-DD` key. */
function keyToLocalDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDateToKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "Павлина Руменова" → "Павлина Р." - enough to tell two clients apart at a glance. */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/** The staff colour folded into the card surface, so both themes stay legible. */
function tint(color: string, amount: number) {
  return `color-mix(in oklab, ${color} ${amount}%, var(--card))`;
}

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
  openNew = false,
}: CalendarBoardProps) {
  const t = useTranslations("admin.calendar");
  const common = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CalendarAppointment | null>(null);
  // One hover card at a time, and none while a card is being dragged.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [newAppointment, setNewAppointment] = useState<{
    dateKey: string;
    minutes: number;
    staffProfileId: string;
  } | null>(
    openNew && staff[0]
      ? { dateKey, minutes: 9 * 60, staffProfileId: staff[0].id }
      : null,
  );
  const [createOpen, setCreateOpen] = useState(openNew && staff.length > 0);
  const [blockOpen, setBlockOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [live, setLive] = useState(false);
  // Cancelling is the one action here that cannot be undone, and with a paid
  // deposit it is also a decision about money - so it takes a second step.
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Cancelled and no-show cards are history, not schedule; they stay out of
  // the way unless asked for.
  const [showCancelled, setShowCancelled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = useNow();
  const todayKey = now === null ? null : zonedDateKey(new Date(now), timezone);
  const nowMinutes = now === null ? null : zonedMinutes(new Date(now), timezone);

  const visibleStaff = useMemo(
    () => (staffFilter === "all" ? staff : staff.filter((s) => s.id === staffFilter)),
    [staff, staffFilter],
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

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }),
    [locale, timezone],
  );
  const longDate = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }),
    [locale],
  );
  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [locale],
  );
  const weekdayShort = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], { weekday: "short", timeZone: "UTC" }),
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

  // Open where the day is: an hour before now on today, the start of the
  // working day otherwise. Runs once per day and view, not on every tick.
  const initialScroll = todayKey !== null && days.includes(todayKey) ? nowMinutes : null;
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const element = scrollRef.current;
    const key = `${view}:${dateKey}`;
    if (!element || scrolledFor.current === key || now === null) return;
    scrolledFor.current = key;
    const target = initialScroll !== null ? initialScroll - 60 : startMinutes;
    element.scrollTop = Math.max(0, (target - startMinutes) * PX_PER_MINUTE);
  }, [dateKey, initialScroll, now, startMinutes, view]);

  function go(daysDelta: number) {
    const next = addDaysToKey(dateKey, daysDelta);
    router.push(`/dashboard/calendar?view=${view}&date=${next}`);
  }

  function goTo(nextKey: string, nextView: "day" | "week" = view) {
    router.push(`/dashboard/calendar?view=${nextView}&date=${nextKey}`);
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
    pxPerMinute: PX_PER_MINUTE,
    snapMinutes: SLOT_MINUTES,
    minMinutes: startMinutes,
    maxMinutes: endMinutes,
    enabled: canManage,
    onCommit: commitDrag,
  });

  function changeStatus(
    appointment: CalendarAppointment,
    status: "confirmed" | "completed" | "no_show" | "cancelled",
    retainDeposit = false,
  ) {
    startTransition(async () => {
      const result = await setAppointmentStatus({
        businessId,
        appointmentId: appointment.id,
        status,
        retainDeposit,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(
        status === "cancelled" && appointment.depositStatus === "paid" && !retainDeposit
          ? t("refundQueued")
          : t("updated"),
      );
      setSelected(null);
      setConfirmingCancel(false);
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
          member: member as CalendarStaff | null,
          dateKey,
          staffProfileId: member.id,
          dayOfWeek: dayOfWeekFromKey(dateKey),
        }))
      : days.map((day) => ({
          id: day,
          member: null as CalendarStaff | null,
          dateKey: day,
          staffProfileId: visibleStaff[0]?.id ?? staff[0].id,
          dayOfWeek: dayOfWeekFromKey(day),
        }));

  // Past six columns the header goes compact: "Мария П." instead of the full
  // name, unless shortening would make two colleagues look the same.
  const compact = columns.length > 6;
  const compactNames = new Map(
    visibleStaff.map((member) => {
      const short = shortName(member.displayName);
      const clash = visibleStaff.some(
        (other) => other.id !== member.id && shortName(other.displayName) === short,
      );
      return [member.id, clash ? member.displayName : short];
    }),
  );

  // The week with the whole team: every stylist booked this week gets a fixed
  // track, in the same order on every day.
  function teamTracks() {
    if (view !== "week" || staffFilter !== "all") return null;
    const booked = new Set(
      appointments
        .filter(
          (appointment) =>
            showCancelled ||
            (appointment.status !== "cancelled" && appointment.status !== "no_show"),
        )
        .map((appointment) => appointment.staffProfileId),
    );
    const order = staff.filter((member) => booked.has(member.id)).map((member) => member.id);
    return order.length > 1 ? order : null;
  }
  const tracks = teamTracks();
  const trackStaff = tracks
    ? tracks.map((id) => staff.find((member) => member.id === id) as CalendarStaff)
    : null;

  function appointmentsFor(column: (typeof columns)[number]) {
    return appointments.filter((appointment) => {
      if (
        !showCancelled &&
        (appointment.status === "cancelled" || appointment.status === "no_show")
      ) {
        return false;
      }
      const start = new Date(appointment.startsAt);
      if (zonedDateKey(start, timezone) !== column.dateKey) return false;
      if (view === "day") return appointment.staffProfileId === column.staffProfileId;
      if (staffFilter !== "all") return appointment.staffProfileId === staffFilter;
      return true;
    });
  }

  function blocksFor(column: (typeof columns)[number]) {
    return blocks.filter((block) => {
      const start = new Date(block.startsAt);
      if (zonedDateKey(start, timezone) !== column.dateKey) return false;
      if (view === "day") return block.staffProfileId === column.staffProfileId;
      if (staffFilter !== "all") return block.staffProfileId === staffFilter;
      return true;
    });
  }

  function workingWindows(column: (typeof columns)[number]) {
    const members =
      view === "day"
        ? staff.filter((member) => member.id === column.staffProfileId)
        : staffFilter === "all"
          ? visibleStaff
          : staff.filter((member) => member.id === staffFilter);

    return members.flatMap((member) =>
      member.hours.filter((window) => window.dayOfWeek === column.dayOfWeek),
    );
  }

  // What the period in view is worth, at a glance: how many visits, what they
  // come to, and how many are already secured by a deposit.
  const inView = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled" &&
      appointment.status !== "no_show" &&
      days.includes(zonedDateKey(new Date(appointment.startsAt), timezone)) &&
      (staffFilter === "all" || appointment.staffProfileId === staffFilter),
  );
  const bookedCents = inView.reduce((sum, appointment) => sum + appointment.priceCents, 0);
  const securedCount = inView.filter((appointment) =>
    SECURED.has(appointment.depositStatus),
  ).length;
  const cancelledCount = appointments.filter(
    (appointment) =>
      (appointment.status === "cancelled" || appointment.status === "no_show") &&
      days.includes(zonedDateKey(new Date(appointment.startsAt), timezone)) &&
      (staffFilter === "all" || appointment.staffProfileId === staffFilter),
  ).length;

  const title =
    view === "week"
      ? `${shortDate.format(keyToDate(days[0]))} – ${shortDate.format(keyToDate(days[days.length - 1]))}`
      : longDate.format(keyToDate(dateKey));

  const weekStrip = Array.from({ length: 7 }, (_, index) =>
    addDaysToKey(startOfWeekKey(dateKey), index),
  );

  const selectedColor =
    staff.find((member) => member.id === selected?.staffProfileId)?.color ?? FALLBACK_COLOR;

  const showNow =
    todayKey !== null &&
    days.includes(todayKey) &&
    nowMinutes !== null &&
    nowMinutes >= startMinutes &&
    nowMinutes <= endMinutes;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-card flex items-center rounded-full border p-1 shadow-[var(--shadow-card)]">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={() => go(view === "week" ? -7 : -1)}
              aria-label={t("previous")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3"
              onClick={() => goTo(zonedDateKey(new Date(), timezone))}
            >
              {t("today")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={() => go(view === "week" ? 7 : 1)}
              aria-label={t("next")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="glowa-focus hover:bg-muted/60 group flex items-center gap-2 rounded-xl px-2 py-1 transition-colors"
                aria-label={t("pickDate")}
              >
                <span className="font-heading text-2xl leading-none first-letter:uppercase sm:text-[1.7rem]">
                  {title}
                </span>
                <ChevronDown
                  className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto rounded-2xl p-2">
              <Calendar
                mode="single"
                locale={PICKER_LOCALES[locale]}
                weekStartsOn={1}
                selected={keyToLocalDate(dateKey)}
                defaultMonth={keyToLocalDate(dateKey)}
                onSelect={(date) => {
                  if (!date) return;
                  setPickerOpen(false);
                  goTo(localDateToKey(date));
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label={t("viewLabel")}
            className="bg-muted flex items-center rounded-full p-1"
          >
            {(["day", "week"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => goTo(dateKey, option)}
                className={cn(
                  "glowa-focus rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
                  view === option
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(option)}
              </button>
            ))}
          </div>

          {canManage ? (
            <>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setBlockOpen(true)}
              >
                <CalendarOff className="size-4" aria-hidden />
                {t("blockTime")}
              </Button>
              <Button
                className="rounded-full"
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
            </>
          ) : null}
        </div>
      </div>

      {/* Week strip: jump to any day of this week in one tap. */}
      {view === "day" ? (
        <div className="grid grid-cols-7 gap-1.5">
          {weekStrip.map((key) => {
            const isSelected = key === dateKey;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => goTo(key)}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "glowa-focus flex items-center justify-center gap-1.5 rounded-xl border px-1 py-1.5 transition-all duration-200",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
                    : "bg-card hover:border-primary/40 hover:-translate-y-0.5",
                )}
              >
                <span
                  className={cn(
                    "text-[0.68rem] tracking-wide uppercase",
                    isSelected ? "text-primary-foreground/85" : "text-muted-foreground",
                  )}
                >
                  {weekdayShort.format(keyToDate(key))}
                </span>
                <span className="font-heading text-base leading-none tabular-nums">
                  {Number(key.slice(8))}
                </span>
                <span
                  className={cn(
                    "size-1 rounded-full",
                    isToday
                      ? isSelected
                        ? "bg-primary-foreground"
                        : "bg-primary"
                      : "bg-transparent",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Team filter + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("staff")}>
          <button
            type="button"
            onClick={() => setStaffFilter("all")}
            aria-pressed={staffFilter === "all"}
            className={cn(
              "glowa-focus rounded-full border px-3 py-1.5 text-sm transition-colors",
              staffFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "bg-card hover:bg-muted",
            )}
          >
            {t("allStaff")}
          </button>
          {staff.map((member) => {
            const active = staffFilter === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setStaffFilter(active ? "all" : member.id)}
                aria-pressed={active}
                className={cn(
                  "glowa-focus flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors",
                  active ? "bg-card shadow-[var(--shadow-card)]" : "bg-card/60 hover:bg-card",
                )}
                style={active ? { borderColor: member.color } : undefined}
              >
                <Avatar className="size-6">
                  {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                  <AvatarFallback
                    className="text-[0.65rem] font-semibold"
                    style={{ backgroundColor: tint(member.color, 22), color: member.color }}
                  >
                    {member.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {member.displayName}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Radio className={cn("size-3.5", live ? "text-success" : "opacity-40")} aria-hidden />
            {t("live")}
            {isPending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          </span>
          <span>
            <span className="font-medium tabular-nums">{inView.length}</span>{" "}
            <span className="text-muted-foreground">
              {t("summaryVisits", { count: inView.length })}
            </span>
          </span>
          {bookedCents > 0 ? (
            <span className="font-medium tabular-nums">
              {formatPrice(bookedCents, appointments[0]?.currency ?? "EUR", locale)}
            </span>
          ) : null}
          {securedCount > 0 ? (
            <span className="text-success inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5" aria-hidden />
              {t("summarySecured", { count: securedCount })}
            </span>
          ) : null}
          {cancelledCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowCancelled((value) => !value)}
              aria-pressed={showCancelled}
              className={cn(
                "glowa-focus rounded-full border px-2.5 py-1 text-xs transition-colors",
                showCancelled ? "bg-foreground text-background border-foreground" : "hover:bg-muted",
              )}
            >
              {t("showCancelled", { count: cancelledCount })}
            </button>
          ) : null}
        </div>
      </div>

      {view === "week" && staffFilter === "all" && staff.length > 2 ? (
        <p className="text-muted-foreground -mt-1 text-xs">{t("weekHint")}</p>
      ) : null}

      {/* The grid */}
      {/*
        One scroll box for both axes, so the team row sticks to its top and the
        hours to its left. The stacking order is fixed: time column 40, team
        row 30 (opaque), now line 10, cards. With the team row and the now line
        both at 10 the line was drawn across the names and avatars.
      */}
      <div className="glowa-card overflow-hidden rounded-2xl">
        <div
          ref={scrollRef}
          className="relative h-[calc(100dvh-15.5rem)] min-h-[34rem] overflow-auto overscroll-contain"
        >
          <div className="flex min-w-max">
            {/* Time gutter */}
            <div className="bg-card sticky left-0 z-40 w-16 shrink-0 border-r">
              <div className="bg-card sticky top-0 z-30 h-16 border-b" />
              <div className="relative" style={{ height: totalMinutes * PX_PER_MINUTE }}>
                {hourMarks.map((minute, index) => (
                  <span
                    key={minute}
                    className={cn(
                      "text-muted-foreground absolute right-2.5 text-[0.7rem] tabular-nums",
                      index === 0 ? "translate-y-1" : "-translate-y-1/2",
                    )}
                    style={{ top: (minute - startMinutes) * PX_PER_MINUTE }}
                  >
                    {minutesLabel(minute)}
                  </span>
                ))}
                {showNow && nowMinutes !== null ? (
                  <span
                    className="bg-primary text-primary-foreground absolute right-1 z-10 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums"
                    style={{ top: (nowMinutes - startMinutes) * PX_PER_MINUTE }}
                  >
                    {minutesLabel(nowMinutes)}
                  </span>
                ) : null}
              </div>
            </div>

            {columns.map((column) => {
              const windows = workingWindows(column);
              const columnAppointments = appointmentsFor(column);
              const laneItems = columnAppointments.map((appointment) => ({
                id: appointment.id,
                start: new Date(appointment.startsAt).getTime(),
                end: new Date(appointment.endsAt).getTime(),
                staffId: appointment.staffProfileId,
              }));
              const lanes = tracks ? staffTracks(laneItems, tracks) : layoutLanes(laneItems);
              const isToday = column.dateKey === todayKey;
              const activeCount = columnAppointments.filter(
                (a) => a.status !== "cancelled" && a.status !== "no_show",
              ).length;
              const openFrom = windows.length
                ? Math.min(...windows.map((w) => w.startMinutes))
                : null;
              const openTo = windows.length ? Math.max(...windows.map((w) => w.endMinutes)) : null;

              return (
                <div
                  key={column.id}
                  className={cn(
                    "flex-1 border-r last:border-r-0",
                    // A big team keeps readable columns and scrolls sideways
                    // under the fixed time column instead of squeezing.
                    compact ? "min-w-36 sm:min-w-40" : "min-w-44 sm:min-w-48",
                  )}
                >
                  {/* Column header */}
                  <div className="bg-card sticky top-0 z-30 flex h-16 items-center gap-2.5 border-b px-3">
                    {column.member ? (
                      <>
                        <span
                          className="rounded-full p-0.5"
                          style={{ boxShadow: `0 0 0 2px ${column.member.color}` }}
                        >
                          <Avatar className="size-8">
                            {column.member.avatarUrl ? (
                              <AvatarImage src={column.member.avatarUrl} alt="" />
                            ) : null}
                            <AvatarFallback
                              className="text-sm font-semibold"
                              style={{
                                backgroundColor: tint(column.member.color, 22),
                                color: column.member.color,
                              }}
                            >
                              {column.member.displayName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </span>
                        <div className="min-w-0">
                          <p
                            className="truncate text-sm font-semibold"
                            title={column.member.displayName}
                          >
                            {compact
                              ? (compactNames.get(column.member.id) ?? column.member.displayName)
                              : column.member.displayName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {windows.length
                              ? t("columnCount", { count: activeCount })
                              : t("closed")}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "font-heading flex size-9 items-center justify-center rounded-full text-lg tabular-nums",
                            isToday ? "bg-primary text-primary-foreground" : "bg-muted",
                          )}
                        >
                          {Number(column.dateKey.slice(8))}
                        </span>
                        <div>
                          <p className="text-sm font-semibold first-letter:uppercase">
                            {weekdayShort.format(keyToDate(column.dateKey))}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {windows.length
                              ? t("columnCount", { count: activeCount })
                              : t("closed")}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Which track is whose: a thin colour key above the lanes. */}
                    {trackStaff && !column.member ? (
                      <div className="absolute inset-x-1 bottom-1 flex gap-px" aria-hidden>
                        {trackStaff.map((member) => (
                          <span
                            key={member.id}
                            title={member.displayName}
                            className="h-1 flex-1 rounded-full"
                            style={{ backgroundColor: tint(member.color, 70) }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={cn("relative", isToday && view === "week" && "bg-primary/[0.03]")}
                    style={{ height: totalMinutes * PX_PER_MINUTE }}
                    // Read back by the drag hook from the pointer position, so
                    // dropping onto another stylist or another day just works.
                    data-calendar-column="1"
                    data-calendar-date={column.dateKey}
                    data-calendar-staff={column.staffProfileId}
                  >
                    {/* Closed time is hatched, so an empty column reads as
                        "closed" rather than "free". */}
                    {openFrom === null || openTo === null ? (
                      <div className="glowa-hatch bg-muted/30 absolute inset-0" aria-hidden />
                    ) : (
                      <>
                        <div
                          className="glowa-hatch bg-muted/30 absolute inset-x-0 top-0"
                          style={{
                            height: Math.max(0, (openFrom - startMinutes) * PX_PER_MINUTE),
                          }}
                          aria-hidden
                        />
                        <div
                          className="glowa-hatch bg-muted/30 absolute inset-x-0 bottom-0"
                          style={{ height: Math.max(0, (endMinutes - openTo) * PX_PER_MINUTE) }}
                          aria-hidden
                        />
                      </>
                    )}

                    {hourMarks.map((minute) => (
                      <div key={minute} aria-hidden>
                        <div
                          className="border-border/70 absolute inset-x-0 border-t"
                          style={{ top: (minute - startMinutes) * PX_PER_MINUTE }}
                        />
                        {minute + 30 < endMinutes ? (
                          <div
                            className="border-border/40 absolute inset-x-0 border-t border-dashed"
                            style={{ top: (minute + 30 - startMinutes) * PX_PER_MINUTE }}
                          />
                        ) : null}
                      </div>
                    ))}

                    {/* Create targets, one per slot. Hovering shows the time
                        you would book, so nobody has to count gridlines. */}
                    {canManage
                      ? Array.from(
                          { length: Math.ceil(totalMinutes / SLOT_MINUTES) },
                          (_, index) => startMinutes + index * SLOT_MINUTES,
                        ).map((minute) => (
                          <button
                            key={minute}
                            type="button"
                            tabIndex={-1}
                            aria-hidden
                            className="group/slot absolute inset-x-1 cursor-pointer rounded-md"
                            style={{
                              top: (minute - startMinutes) * PX_PER_MINUTE,
                              height: SLOT_MINUTES * PX_PER_MINUTE,
                            }}
                            onClick={() => {
                              // A drag that ended over this cell must not also
                              // open the "new appointment" dialog.
                              if (isDragging) return;
                              openCell(column.dateKey, minute, column.staffProfileId);
                            }}
                          >
                            <span className="border-primary/50 bg-primary/10 text-primary flex h-full items-center gap-1 rounded-md border border-dashed px-2 text-[0.7rem] font-medium opacity-0 transition-opacity duration-150 group-hover/slot:opacity-100">
                              <Plus className="size-3" aria-hidden />
                              {minutesLabel(minute)}
                            </span>
                          </button>
                        ))
                      : null}

                    {/* Now */}
                    {isToday && showNow && nowMinutes !== null ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                        style={{ top: (nowMinutes - startMinutes) * PX_PER_MINUTE }}
                      >
                        <span className="bg-primary -ml-1 size-2.5 shrink-0 -translate-y-px rounded-full shadow-[0_0_0_3px_var(--card)]" />
                        <span className="bg-primary h-0.5 flex-1 -translate-y-px" />
                      </div>
                    ) : null}

                    {blocksFor(column).map((block) => {
                      const top =
                        (zonedMinutes(new Date(block.startsAt), timezone) - startMinutes) *
                        PX_PER_MINUTE;
                      const height =
                        ((new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) /
                          60000) *
                        PX_PER_MINUTE;
                      return (
                        <div
                          key={block.id}
                          className="glowa-hatch bg-muted/70 text-muted-foreground absolute inset-x-1 flex items-start gap-1.5 rounded-lg border border-dashed px-2 py-1.5 text-[0.72rem]"
                          style={{ top, height: Math.max(height, 22) }}
                        >
                          <Lock className="mt-px size-3 shrink-0" aria-hidden />
                          <span className="truncate">{block.reason || t("blockedLabel")}</span>
                        </div>
                      );
                    })}

                    {columnAppointments.map((appointment) => {
                      const originStart = zonedMinutes(new Date(appointment.startsAt), timezone);
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

                      const top = (shownStart - startMinutes) * PX_PER_MINUTE;
                      const height = Math.max(shownDuration * PX_PER_MINUTE, 26);
                      const member = staff.find((s) => s.id === appointment.staffProfileId);
                      const color = member?.color ?? FALLBACK_COLOR;
                      const isInactive =
                        appointment.status === "cancelled" || appointment.status === "no_show";
                      const isPendingStatus = appointment.status === "pending";
                      const draggable = canManage && !isInactive;
                      const lane = lanes.get(appointment.id) ?? { lane: 0, lanes: 1 };
                      // Narrow lanes carry the time and a colour, nothing that
                      // would be cut off mid-word; the hover card has the rest.
                      const narrow = lane.lanes >= 3;
                      // Four or more side by side: a word would be cut to one
                      // letter, so the lane is colour alone and the hover card
                      // and the sheet carry the details.
                      const tiny = lane.lanes >= 4;

                      const target: DragTarget = {
                        id: appointment.id,
                        startMinutes: originStart,
                        durationMinutes: originDuration,
                        dateKey: column.dateKey,
                        staffProfileId: column.staffProfileId,
                      };

                      const startLabel = timeFormatter.format(
                        isGhost
                          ? instantFromZoned(dragPreview.dateKey, shownStart, timezone)
                          : new Date(appointment.startsAt),
                      );
                      const endLabel = timeFormatter.format(
                        isGhost
                          ? instantFromZoned(
                              dragPreview.dateKey,
                              shownStart + shownDuration,
                              timezone,
                            )
                          : new Date(appointment.endsAt),
                      );

                      const depositIcon = SECURED.has(appointment.depositStatus) ? (
                        <ShieldCheck
                          className="text-success size-3 shrink-0"
                          aria-label={t("depositSecured")}
                        />
                      ) : appointment.depositStatus === "awaiting" ? (
                        <Hourglass
                          className="text-primary size-3 shrink-0"
                          aria-label={t("depositAwaiting")}
                        />
                      ) : null;
                      const hasNotes = Boolean(
                        appointment.customerNotes || appointment.internalNotes,
                      );
                      const who = appointment.customerName
                        ? shortName(appointment.customerName)
                        : null;
                      // The height decides how many lines fit, and each line is
                      // a choice of what matters most - time, then who, then
                      // what. Everything else waits for the hover card.
                      const lines = narrow ? 1 : height >= 76 ? 3 : height >= 44 ? 2 : 1;
                      const primary = who ?? appointment.serviceName;

                      return (
                        <HoverCard
                          key={appointment.id}
                          open={!isDragging && hoverId === appointment.id}
                          onOpenChange={(open) =>
                            setHoverId((current) =>
                              open ? appointment.id : current === appointment.id ? null : current,
                            )
                          }
                          openDelay={250}
                          closeDelay={60}
                        >
                          <HoverCardTrigger asChild>
                            <div
                              className={cn(
                                "group/card absolute overflow-hidden rounded-[0.6rem] border leading-snug transition-[box-shadow,transform] duration-200",
                                "hover:z-10 hover:shadow-[var(--shadow-lift)]",
                                isInactive && "glowa-hatch opacity-60",
                                isGhost &&
                                  "ring-primary/60 z-20 scale-[1.02] shadow-[var(--shadow-pop)] ring-2",
                              )}
                              style={{
                                top,
                                height,
                                left: isGhost
                                  ? 4
                                  : `calc(${(lane.lane / lane.lanes) * 100}% + ${lane.lane === 0 ? 4 : 1}px)`,
                                width: isGhost
                                  ? "calc(100% - 10px)"
                                  : `calc(${100 / lane.lanes}% - ${lane.lanes === 1 ? 10 : 3}px)`,
                                backgroundColor: isInactive ? "var(--muted)" : tint(color, 14),
                                borderColor: tint(color, isPendingStatus ? 70 : 32),
                                borderStyle: isPendingStatus ? "dashed" : "solid",
                                // Without this the browser scrolls the page
                                // instead of letting the finger drag the card.
                                touchAction: draggable ? "none" : undefined,
                              }}
                            >
                              <span
                                className="absolute inset-y-0 left-0 w-[3px]"
                                style={{
                                  backgroundColor: isInactive
                                    ? "var(--muted-foreground)"
                                    : color,
                                }}
                                aria-hidden
                              />
                              <button
                                type="button"
                                aria-label={`${startLabel}–${endLabel}, ${appointment.serviceName}${
                                  appointment.customerName ? `, ${appointment.customerName}` : ""
                                }`}
                                onPointerDown={(event) => {
                                  setHoverId(null);
                                  if (draggable) beginDrag(event, "move", target);
                                }}
                                onClick={() => {
                                  if (isDragging) return;
                                  setHoverId(null);
                                  setSelected(appointment);
                                  setNotesDraft(appointment.internalNotes ?? "");
                                  setConfirmingCancel(false);
                                }}
                                className={cn(
                                  // A button centres its content; a long visit
                                  // reads from the top, like the hour it starts.
                                  "glowa-focus flex size-full flex-col justify-start text-left",
                                  narrow ? "py-1 pr-1 pl-2" : "py-1.5 pr-1.5 pl-2.5",
                                  draggable && "cursor-grab active:cursor-grabbing",
                                )}
                              >
                                {tiny ? null : (
                                  <>
                                    <span className="flex items-center gap-1.5 text-[0.72rem]">
                                      <span
                                        className={cn(
                                          "shrink-0 font-semibold tabular-nums",
                                          lines > 1 && "text-foreground/65",
                                        )}
                                      >
                                        {startLabel}
                                      </span>
                                      {lines === 1 && !narrow ? (
                                        <span
                                          className={cn(
                                            "min-w-0 truncate font-semibold",
                                            isInactive && "line-through",
                                          )}
                                        >
                                          {primary}
                                        </span>
                                      ) : null}
                                      {narrow ? null : (
                                        <span className="ml-auto flex shrink-0 items-center gap-1">
                                          {depositIcon}
                                          {/* Notes show without opening the card - a
                                              note you have to hunt for is a note
                                              nobody reads. */}
                                          {hasNotes ? (
                                            <StickyNote
                                              className="text-warning size-3 shrink-0"
                                              aria-label={t("hasNotes")}
                                            />
                                          ) : null}
                                          {appointment.status === "completed" ? (
                                            <CheckCircle2
                                              className="text-success size-3 shrink-0"
                                              aria-hidden
                                            />
                                          ) : null}
                                        </span>
                                      )}
                                    </span>
                                    {lines >= 2 ? (
                                      <span
                                        className={cn(
                                          "mt-px block truncate text-[0.84rem] font-semibold",
                                          isInactive && "line-through",
                                        )}
                                      >
                                        {primary}
                                      </span>
                                    ) : null}
                                    {lines >= 3 && who ? (
                                      <span className="text-muted-foreground block truncate text-[0.74rem]">
                                        {appointment.serviceName}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </button>

                              {/* Bottom edge: drag to change how long it takes. */}
                              {draggable ? (
                                <span
                                  role="presentation"
                                  onPointerDown={(event) => {
                                    setHoverId(null);
                                    beginDrag(event, "resize", target);
                                  }}
                                  className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-center justify-center"
                                  style={{ touchAction: "none" }}
                                >
                                  <span className="bg-foreground/25 h-0.5 w-6 rounded-full opacity-0 transition-opacity group-hover/card:opacity-100" />
                                </span>
                              ) : null}
                            </div>
                          </HoverCardTrigger>

                          <HoverCardContent
                            side="right"
                            align="start"
                            collisionPadding={12}
                            className="w-[19rem] overflow-hidden"
                          >
                            <div
                              className="border-b px-4 pt-3.5 pb-3"
                              style={{ backgroundColor: tint(color, 14) }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <AppointmentStatusBadge status={appointment.status} />
                                <span className="text-foreground/70 truncate text-xs first-letter:uppercase">
                                  {longDate.format(keyToDate(column.dateKey))}
                                </span>
                              </div>
                              <p className="font-heading mt-2 text-[1.05rem] leading-tight">
                                {appointment.serviceName}
                              </p>
                              <p className="text-foreground/80 mt-1 text-sm tabular-nums">
                                {startLabel} – {endLabel}
                                <span className="text-foreground/50"> · </span>
                                {t("durationMinutes", { minutes: Math.round(shownDuration) })}
                              </p>
                            </div>

                            <dl className="space-y-3 px-4 py-3.5 text-sm">
                              <div className="flex items-start gap-3">
                                <dt className="sr-only">{t("customer")}</dt>
                                <UserRound
                                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                                  aria-hidden
                                />
                                <dd className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {appointment.customerName ?? "—"}
                                  </span>
                                  {appointment.customerPhone ? (
                                    <a
                                      href={`tel:${appointment.customerPhone}`}
                                      className="text-muted-foreground hover:text-primary text-xs tabular-nums"
                                    >
                                      {appointment.customerPhone}
                                    </a>
                                  ) : null}
                                </dd>
                              </div>

                              {member ? (
                                <div className="flex items-center gap-3">
                                  <dt className="sr-only">{t("staff")}</dt>
                                  <Avatar className="size-4">
                                    {member.avatarUrl ? (
                                      <AvatarImage src={member.avatarUrl} alt="" />
                                    ) : null}
                                    <AvatarFallback
                                      className="text-[0.5rem] font-semibold text-white"
                                      style={{ backgroundColor: color }}
                                    >
                                      {member.displayName.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <dd className="truncate">{member.displayName}</dd>
                                </div>
                              ) : null}

                              <div className="flex items-center gap-3">
                                <dt className="sr-only">{t("price")}</dt>
                                <Wallet
                                  className="text-muted-foreground size-4 shrink-0"
                                  aria-hidden
                                />
                                <dd className="font-medium tabular-nums">
                                  {formatPrice(
                                    appointment.priceCents,
                                    appointment.currency,
                                    locale,
                                  )}
                                </dd>
                              </div>

                              {appointment.depositStatus !== "none" ? (
                                <div className="flex items-center gap-3">
                                  <dt className="sr-only">{t("deposit")}</dt>
                                  {SECURED.has(appointment.depositStatus) ? (
                                    <ShieldCheck className="text-success size-4 shrink-0" aria-hidden />
                                  ) : (
                                    <Hourglass
                                      className={cn(
                                        "size-4 shrink-0",
                                        appointment.depositStatus === "awaiting"
                                          ? "text-primary"
                                          : "text-muted-foreground",
                                      )}
                                      aria-hidden
                                    />
                                  )}
                                  <dd>
                                    {t("deposit")}{" "}
                                    <span className="font-medium tabular-nums">
                                      {formatPrice(
                                        appointment.depositCents,
                                        appointment.currency,
                                        locale,
                                      )}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-xs",
                                        SECURED.has(appointment.depositStatus)
                                          ? "text-success"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {" · "}
                                      {t(`depositStatus.${appointment.depositStatus}`)}
                                    </span>
                                  </dd>
                                </div>
                              ) : null}

                              {appointment.customerNotes ? (
                                <div className="bg-muted/60 rounded-xl px-3 py-2">
                                  <dt className="text-muted-foreground text-xs">
                                    {t("customerNotes")}
                                  </dt>
                                  <dd className="mt-0.5 line-clamp-3 whitespace-pre-line">
                                    {appointment.customerNotes}
                                  </dd>
                                </div>
                              ) : null}
                              {appointment.internalNotes ? (
                                <div className="bg-warning/10 rounded-xl px-3 py-2">
                                  <dt className="text-muted-foreground flex items-center gap-1 text-xs">
                                    <StickyNote className="text-warning size-3" aria-hidden />
                                    {t("internalNotes")}
                                  </dt>
                                  <dd className="mt-0.5 line-clamp-3 whitespace-pre-line">
                                    {appointment.internalNotes}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>

                            <p className="text-muted-foreground bg-muted/40 border-t px-4 py-2 text-xs">
                              {t("hoverHint")}
                            </p>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}

                    {/* A card dragged in from another column is drawn here. */}
                    {dragPreview &&
                    dragPreview.mode === "move" &&
                    dragPreview.dateKey === column.dateKey &&
                    dragPreview.staffProfileId === column.staffProfileId &&
                    !columnAppointments.some((a) => a.id === dragPreview.id) ? (
                      <div
                        aria-hidden
                        className="border-primary bg-primary/15 pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed"
                        style={{
                          top: (dragPreview.startMinutes - startMinutes) * PX_PER_MINUTE,
                          height: Math.max(dragPreview.durationMinutes * PX_PER_MINUTE, 26),
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          {selected ? (
            <>
              <div
                className="border-b px-6 pt-8 pb-5"
                style={{ backgroundColor: tint(selectedColor, 12) }}
              >
                <SheetHeader className="p-0">
                  <div className="flex items-center gap-2">
                    <AppointmentStatusBadge status={selected.status} />
                    {SECURED.has(selected.depositStatus) ? (
                      <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
                        <ShieldCheck className="size-3.5" aria-hidden />
                        {t("depositSecured")}
                      </span>
                    ) : null}
                  </div>
                  <SheetTitle className="font-heading mt-2 text-2xl">
                    {selected.serviceName}
                  </SheetTitle>
                  <SheetDescription className="text-foreground/80 text-sm tabular-nums first-letter:uppercase">
                    {longDate.format(
                      keyToDate(zonedDateKey(new Date(selected.startsAt), timezone)),
                    )}
                    {" · "}
                    {timeFormatter.format(new Date(selected.startsAt))} –{" "}
                    {timeFormatter.format(new Date(selected.endsAt))}
                  </SheetDescription>
                </SheetHeader>
              </div>

              <div className="space-y-5 px-6 py-5">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <dt className="text-muted-foreground text-xs">{t("customer")}</dt>
                    <dd className="mt-0.5 font-medium">{selected.customerName ?? "—"}</dd>
                    {selected.customerPhone ? (
                      <dd>
                        <a
                          href={`tel:${selected.customerPhone}`}
                          className="text-primary inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                        >
                          <Phone className="size-3.5" aria-hidden />
                          {selected.customerPhone}
                        </a>
                      </dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("price")}</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {formatPrice(selected.priceCents, selected.currency, locale)}
                    </dd>
                  </div>
                  {selected.depositStatus !== "none" ? (
                    <div>
                      <dt className="text-muted-foreground text-xs">{t("deposit")}</dt>
                      <dd className="mt-0.5">
                        <span className="font-medium tabular-nums">
                          {formatPrice(selected.depositCents, selected.currency, locale)}
                        </span>{" "}
                        <span
                          className={cn(
                            "text-xs",
                            SECURED.has(selected.depositStatus)
                              ? "text-success"
                              : "text-muted-foreground",
                          )}
                        >
                          · {t(`depositStatus.${selected.depositStatus}`)}
                        </span>
                      </dd>
                    </div>
                  ) : null}
                  {selected.customerNotes ? (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground text-xs">{t("customerNotes")}</dt>
                      <dd className="bg-muted/60 mt-1 rounded-lg p-3 whitespace-pre-line">
                        {selected.customerNotes}
                      </dd>
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
                    placeholder={t("internalNotesHint")}
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
                    <div className="grid grid-cols-2 gap-2">
                      {selected.status === "pending" ? (
                        <Button
                          className="col-span-2"
                          onClick={() => changeStatus(selected, "confirmed")}
                          disabled={isPending}
                        >
                          {t("markConfirmed")}
                        </Button>
                      ) : null}
                      {selected.status !== "completed" ? (
                        <Button
                          variant="outline"
                          onClick={() => changeStatus(selected, "completed")}
                          disabled={isPending}
                        >
                          <CheckCircle2 className="size-4" aria-hidden />
                          {t("markCompleted")}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => changeStatus(selected, "no_show")}
                        disabled={isPending}
                      >
                        {t("markNoShow")}
                      </Button>
                      {selected.status === "pending" || selected.status === "confirmed" ? (
                        <Button
                          variant="ghost"
                          className="text-destructive hover:text-destructive col-span-2"
                          onClick={() => setConfirmingCancel(true)}
                          disabled={isPending || confirmingCancel}
                        >
                          {t("cancelAppointment")}
                        </Button>
                      ) : null}
                    </div>
                    {selected.depositStatus === "paid" ? (
                      <p className="text-muted-foreground text-xs">{t("noShowKeepsDeposit")}</p>
                    ) : null}

                    {confirmingCancel ? (
                      <div className="border-destructive/30 bg-destructive/5 space-y-3 rounded-xl border p-4">
                        <p className="text-sm font-medium">{t("cancelConfirmTitle")}</p>
                        {selected.depositStatus === "paid" ? (
                          <p className="text-muted-foreground text-xs">
                            {t("cancelDepositChoice", {
                              amount:
                                formatPrice(selected.depositCents, selected.currency, locale) ??
                                "",
                            })}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => changeStatus(selected, "cancelled")}
                            disabled={isPending}
                          >
                            {selected.depositStatus === "paid"
                              ? t("cancelAndRefund")
                              : t("cancelConfirm")}
                          </Button>
                          {selected.depositStatus === "paid" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => changeStatus(selected, "cancelled", true)}
                              disabled={isPending}
                            >
                              {t("cancelAndRetain")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmingCancel(false)}
                            disabled={isPending}
                          >
                            {common("back")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
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
