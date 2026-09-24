"use client";

import { CalendarX2, Loader2, Moon, Sun, Sunrise, Zap } from "lucide-react";
import { m } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  const dayNumberFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeHrefLang[locale], { day: "numeric", timeZone: timezone }),
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
  const firstFree = days.find((day) => day.count > 0);
  const firstSlot = firstFree ? byDay.get(firstFree.key)?.[0] : undefined;

  // Morning, afternoon, evening - in the salon's clock. A wall of twenty
  // identical buttons is hard to scan; three short rows are not.
  const hourOf = (slot: Slot) =>
    Number(
      new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(
        new Date(slot.starts_at),
      ),
    );
  const periods = [
    { key: "morning" as const, icon: Sunrise, slots: times.filter((slot) => hourOf(slot) < 12) },
    {
      key: "afternoon" as const,
      icon: Sun,
      slots: times.filter((slot) => hourOf(slot) >= 12 && hourOf(slot) < 17),
    },
    { key: "evening" as const, icon: Moon, slots: times.filter((slot) => hourOf(slot) >= 17) },
  ].filter((period) => period.slots.length > 0);

  const monthLabel = new Intl.DateTimeFormat(localeHrefLang[locale], {
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(`${activeDay}T12:00:00Z`));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-heading text-lg first-letter:uppercase">{monthLabel}</p>
        {firstSlot && value?.starts_at !== firstSlot.starts_at ? (
          <button
            type="button"
            onClick={() => {
              setSelectedDay(firstFree!.key);
              onChange(firstSlot);
            }}
            className="glowa-focus bg-primary/10 text-primary hover:bg-primary/15 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <Zap className="size-3.5" aria-hidden />
            {t("firstFree", {
              when: `${dayFormatter.format(new Date(firstSlot.starts_at))} ${timeFormatter.format(new Date(firstSlot.starts_at))}`,
            })}
          </button>
        ) : null}
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-3" role="tablist" aria-label={t("chooseTime")}>
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
                  "glowa-focus flex w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all duration-200",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
                    : "bg-card hover:border-primary/40 hover:-translate-y-0.5",
                  disabled && "cursor-not-allowed opacity-35 hover:translate-y-0 hover:border-border",
                )}
              >
                <span
                  className={cn(
                    "text-[0.65rem] tracking-wide uppercase",
                    isActive ? "text-primary-foreground/85" : "text-muted-foreground",
                  )}
                >
                  {dayFormatter.format(day.date)}
                </span>
                <span className="font-heading text-xl leading-none tabular-nums">
                  {dayNumberFormatter.format(day.date)}
                </span>
                <span
                  className={cn(
                    "h-1 w-6 rounded-full",
                    disabled
                      ? "bg-transparent"
                      : isActive
                        ? "bg-primary-foreground/70"
                        : day.count >= 8
                          ? "bg-success/70"
                          : "bg-warning/70",
                  )}
                  aria-hidden
                />
                <span className="sr-only">{t("slotsCount", { count: day.count })}</span>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

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
          transition={{ duration: 0.3 }}
          className="space-y-5"
          role="radiogroup"
          aria-label={t("chooseTime")}
        >
          {periods.map((period) => (
            <div key={period.key} className="space-y-2.5">
              <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-[0.12em] uppercase">
                <period.icon className="size-3.5" aria-hidden />
                {t(period.key)}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {period.slots.map((slot) => {
                  const isSelected = value?.starts_at === slot.starts_at;
                  return (
                    <button
                      key={slot.starts_at}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onChange(slot)}
                      className={cn(
                        "glowa-focus relative rounded-full border py-2.5 text-sm font-medium tabular-nums transition-all duration-200",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                          : "bg-card hover:border-primary/50 hover:text-primary",
                      )}
                    >
                      {timeFormatter.format(new Date(slot.starts_at))}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </m.div>
      )}

      <p className="text-muted-foreground text-xs">
        {t("timezoneNote", { zone: timezone })}
        {viewerZone && viewerZone !== timezone ? (
          <>
            {" "}
            {t("timezoneDiffers", { viewer: viewerZone })}
          </>
        ) : null}
      </p>
    </div>
  );
}
