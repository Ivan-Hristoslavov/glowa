"use client";

import { CalendarX2, ChevronLeft, ChevronRight, Loader2, Moon, Sun, Sunrise } from "lucide-react";
import { m } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { fetchSlots, type Slot } from "@/lib/actions/booking";
import { addDays, resolveViewerTimeZone, toZonedDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One request covers the whole window and the result is grouped client-side,
 * so switching days is instant and the day strip can grey out days with
 * nothing free. See PROJECT_CONTEXT for the scaling note on this.
 */
const WINDOW_DAYS = 21;

type SlotPickerProps = {
  /** Rendered next to the "no slots" state; the dead end is the whole point. */
  waitlist?: React.ReactNode;
  serviceId: string;
  staffProfileId: string | null;
  locationId: string | null;
  timezone: string;
  locale: Locale;
  value: Slot | null;
  onChange: (slot: Slot | null) => void;
};

export function SlotPicker({
  waitlist,
  serviceId,
  staffProfileId,
  locationId,
  timezone,
  locale,
  value,
  onChange,
}: SlotPickerProps) {
  const t = useTranslations("booking");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = useMemo(() => new Date(), []);
  const viewerZone = useMemo(() => resolveViewerTimeZone(), []);

  // No synchronous setState here: the parent remounts this component with a
  // fresh `key` when the service, specialist or location changes, so state
  // starts empty rather than being cleared mid-effect.
  useEffect(() => {
    let cancelled = false;

    startTransition(async () => {
      const result = await fetchSlots({
        serviceId,
        from: toZonedDateKey(today, timezone),
        to: toZonedDateKey(addDays(today, WINDOW_DAYS - 1), timezone),
        staffProfileId,
        locationId,
      });
      if (cancelled) return;
      setSlots(result.ok ? result.slots : []);
    });

    return () => {
      cancelled = true;
    };
  }, [serviceId, staffProfileId, locationId, timezone, today]);

  /** date key -> earliest slot per start time (dedupes "any specialist"). */
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const key = toZonedDateKey(new Date(slot.starts_at), timezone);
      const list = map.get(key) ?? [];
      if (!list.some((existing) => existing.starts_at === slot.starts_at)) {
        list.push(slot);
      }
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return map;
  }, [slots, timezone]);

  const days = useMemo(
    () =>
      Array.from({ length: WINDOW_DAYS }, (_, index) => {
        const date = addDays(today, index);
        const key = toZonedDateKey(date, timezone);
        return { key, date, count: byDay.get(key)?.length ?? 0 };
      }),
    [byDay, timezone, today],
  );

  const activeDay =
    selectedDay && byDay.has(selectedDay)
      ? selectedDay
      : (days.find((day) => day.count > 0)?.key ?? null);

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        weekday: "short",
        timeZone: timezone,
      }),
    [locale, timezone],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        day: "numeric",
        month: "short",
        timeZone: timezone,
      }),
    [locale, timezone],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }),
    [locale, timezone],
  );

  if (slots === null || isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("loadingSlots")}
        </p>
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-16 shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeDay) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={t("noSlots")}
        body={t("noSlotsBody")}
        action={waitlist}
      />
    );
  }

  const times = byDay.get(activeDay) ?? [];

  // Morning, afternoon, evening: a long column of identical buttons is hard
  // to scan, and "something after work" is how people actually think.
  const hourFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  });
  const periods = (["morning", "afternoon", "evening"] as const)
    .map((period) => ({
      period,
      slots: times.filter((slot) => {
        const hour = Number(hourFormatter.format(new Date(slot.starts_at)));
        return period === "morning" ? hour < 12 : period === "afternoon" ? hour < 17 : hour >= 17;
      }),
    }))
    .filter((group) => group.slots.length > 0);

  const PERIOD_ICON = { morning: Sunrise, afternoon: Sun, evening: Moon } as const;

  return (
    <div className="space-y-5">
      <DayStrip
        label={t("chooseTime")}
        earlier={t("earlier")}
        later={t("later")}
        caption={
          <>
            {t("timezoneNote", { zone: timezone })}
            {viewerZone && viewerZone !== timezone ? (
              <> {t("timezoneDiffers", { viewer: viewerZone })}</>
            ) : null}
          </>
        }
      >
        {days.map((day) => {
          const isActive = day.key === activeDay;
          const disabled = day.count === 0;
          return (
            <button
              key={day.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => {
                setSelectedDay(day.key);
                onChange(null);
              }}
              className={cn(
                "glowa-focus relative flex w-[4.25rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-2xl border px-2 py-3 text-center transition-colors duration-300",
                isActive
                  ? "text-primary-foreground border-transparent"
                  : "border-border bg-card hover:border-primary/40",
                disabled && "cursor-not-allowed opacity-35 hover:border-border",
              )}
            >
              {isActive ? (
                <m.span
                  layoutId="active-day"
                  className="bg-primary absolute inset-0 rounded-2xl"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden
                />
              ) : null}
              <span className="relative text-[0.65rem] tracking-wide uppercase">
                {dayFormatter.format(day.date)}
              </span>
              <span className="relative text-sm font-semibold tabular-nums">
                {dateFormatter.format(day.date)}
              </span>
              {!disabled ? (
                <span
                  className={cn(
                    "relative mt-0.5 size-1 rounded-full",
                    isActive ? "bg-primary-foreground/80" : "bg-primary/70",
                  )}
                  aria-hidden
                />
              ) : (
                <span className="relative mt-0.5 size-1" aria-hidden />
              )}
            </button>
          );
        })}
      </DayStrip>

      {times.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={t("noSlots")}
          body={t("noSlotsBody")}
          action={waitlist}
        />
      ) : (
        <m.div
          key={activeDay}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
          role="radiogroup"
          aria-label={t("chooseTime")}
        >
          {periods.map(({ period, slots: group }) => {
            const Icon = PERIOD_ICON[period];
            return (
              <div key={period} className="space-y-2">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                  <Icon className="size-3.5" aria-hidden />
                  {t(period)}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {group.map((slot) => {
                    const isSelected = value?.starts_at === slot.starts_at;
                    return (
                      <button
                        key={slot.starts_at}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onChange(slot)}
                        className={cn(
                          "glowa-focus relative h-11 rounded-xl border text-sm font-medium tabular-nums transition-all duration-200 active:scale-95",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-primary/30 shadow-md"
                            : "border-border bg-card hover:border-primary/50 hover:text-primary",
                        )}
                      >
                        {timeFormatter.format(new Date(slot.starts_at))}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </m.div>
      )}
    </div>
  );
}

/**
 * The horizontally scrolling day list, with arrows on wider screens: a strip
 * that is cut off at the edge does not say "there is more" to everyone, and a
 * mouse has no swipe.
 */
function DayStrip({
  label,
  earlier,
  later,
  caption,
  children,
}: {
  label: string;
  earlier: string;
  later: string;
  caption: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function scroll(direction: 1 | -1) {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <p className="text-muted-foreground text-xs">{caption}</p>
        <div className="hidden shrink-0 gap-1 sm:flex">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={earlier}
            className="glowa-focus hover:bg-accent flex size-8 items-center justify-center rounded-full border transition-colors"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={later}
            className="glowa-focus hover:bg-accent flex size-8 items-center justify-center rounded-full border transition-colors"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative">
        <div
          ref={ref}
          role="tablist"
          aria-label={label}
          className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
        <div
          className="from-background pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
