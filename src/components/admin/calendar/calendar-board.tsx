"use client";

import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Radio,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
const PX_PER_MINUTE = 1;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 20 * 60;

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

  const [staffFilter, setStaffFilter] = useState<string>("all");
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

        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="w-44" aria-label={t("staff")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStaff")}</SelectItem>
            {staff.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canManage ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBlockOpen(true)}>
              <CalendarOff className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t("blockTime")}</span>
            </Button>
            <Button
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
              <span className="hidden sm:inline">{t("newAppointment")}</span>
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Radio className={cn("size-3.5", live ? "text-success" : "opacity-40")} aria-hidden />
        {t("liveHint")}
        {isPending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      </p>

      <div className="glowa-card overflow-x-auto">
        <div className="flex min-w-max">
          {/* Time gutter */}
          <div className="border-border/70 bg-card sticky left-0 z-10 w-14 shrink-0 border-r">
            <div className="border-border/70 h-10 border-b" />
            <div className="relative" style={{ height: totalMinutes * PX_PER_MINUTE }}>
              {hourMarks.map((minute) => (
                <span
                  key={minute}
                  className="text-muted-foreground absolute right-2 -translate-y-1/2 text-[0.7rem]"
                  style={{ top: (minute - startMinutes) * PX_PER_MINUTE }}
                >
                  {String(Math.floor(minute / 60)).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          </div>

          {columns.map((column) => {
            const windows = workingWindows(column);
            return (
              <div key={column.id} className="border-border/70 min-w-40 flex-1 border-r last:border-r-0">
                <div className="border-border/70 flex h-10 items-center gap-2 border-b px-3">
                  {column.color ? (
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: column.color }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="truncate text-sm font-medium">{column.label}</span>
                </div>

                <div
                  className="relative"
                  style={{ height: totalMinutes * PX_PER_MINUTE }}
                  // Read back by the drag hook from the pointer position, so
                  // dropping onto another stylist or another day just works.
                  data-calendar-column="1"
                  data-calendar-date={column.dateKey}
                  data-calendar-staff={column.staffProfileId}
                >
                  {/* Closed time is shaded, so an empty column reads as "closed"
                      rather than "free". */}
                  {windows.length === 0 ? (
                    <div className="bg-muted/40 absolute inset-0" aria-hidden />
                  ) : (
                    <>
                      <div className="bg-muted/40 absolute inset-x-0 top-0" style={{ height: Math.max(0, (Math.min(...windows.map((w) => w.startMinutes)) - startMinutes) * PX_PER_MINUTE) }} aria-hidden />
                      <div className="bg-muted/40 absolute inset-x-0 bottom-0" style={{ height: Math.max(0, (endMinutes - Math.max(...windows.map((w) => w.endMinutes))) * PX_PER_MINUTE) }} aria-hidden />
                    </>
                  )}

                  {hourMarks.map((minute) => (
                    <div
                      key={minute}
                      className="border-border/50 absolute inset-x-0 border-t"
                      style={{ top: (minute - startMinutes) * PX_PER_MINUTE }}
                      aria-hidden
                    />
                  ))}

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
                        top: (minute - startMinutes) * PX_PER_MINUTE,
                        height: SLOT_MINUTES * PX_PER_MINUTE,
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
                    const top = (zonedMinutes(new Date(block.startsAt), timezone) - startMinutes) * PX_PER_MINUTE;
                    const height =
                      ((new Date(block.endsAt).getTime() - new Date(block.startsAt).getTime()) / 60000) *
                      PX_PER_MINUTE;
                    return (
                      <div
                        key={block.id}
                        className="border-border bg-muted/80 text-muted-foreground absolute inset-x-1 rounded-md border border-dashed px-2 py-1 text-[0.7rem]"
                        style={{ top, height: Math.max(height, 18) }}
                      >
                        {block.reason || t("blockedLabel")}
                      </div>
                    );
                  })}

                  {appointmentsFor(column).map((appointment) => {
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

                    const top = (shownStart - startMinutes) * PX_PER_MINUTE;
                    const height = shownDuration * PX_PER_MINUTE;
                    const member = staff.find((s) => s.id === appointment.staffProfileId);
                    const isCancelled =
                      appointment.status === "cancelled" || appointment.status === "no_show";
                    const draggable = canManage && !isCancelled;

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
                          "absolute inset-x-1 rounded-md border text-[0.72rem] leading-tight shadow-sm transition-shadow",
                          isCancelled && "opacity-50",
                          isGhost && "z-20 shadow-lg ring-2 ring-primary/60",
                        )}
                        style={{
                          top,
                          height: Math.max(height, 22),
                          backgroundColor: `${member?.color ?? "#D96C61"}22`,
                          borderColor: `${member?.color ?? "#D96C61"}66`,
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
                          className={cn(
                            "glowa-focus block size-full overflow-hidden rounded-md px-2 py-1 text-left",
                            draggable && "cursor-grab active:cursor-grabbing",
                            isCancelled && "line-through",
                          )}
                        >
                          <span className="block truncate font-medium">
                            {timeFormatter.format(
                              isGhost
                                ? instantFromZoned(
                                    dragPreview.dateKey,
                                    shownStart,
                                    timezone,
                                  )
                                : new Date(appointment.startsAt),
                            )}{" "}
                            · {appointment.serviceName}
                          </span>
                          <span className="text-muted-foreground block truncate">
                            {appointment.customerName ?? "—"}
                          </span>
                        </button>

                        {/* Bottom edge: drag to change how long it takes. */}
                        {draggable ? (
                          <span
                            role="presentation"
                            onPointerDown={(event) =>
                              beginDrag(event, "resize", target)
                            }
                            className="hover:bg-primary/40 absolute inset-x-0 bottom-0 h-2 cursor-ns-resize rounded-b-md"
                            style={{ touchAction: "none" }}
                          />
                        ) : null}
                      </div>
                    );
                  })}

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
                        top: (dragPreview.startMinutes - startMinutes) * PX_PER_MINUTE,
                        height: Math.max(dragPreview.durationMinutes * PX_PER_MINUTE, 22),
                      }}
                    />
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
                      <dt className="text-muted-foreground text-xs">{t("customer")}</dt>
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
