"use client";

import { CalendarX2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {t("timezoneNote", { zone: timezone })}
        {viewerZone && viewerZone !== timezone ? (
          <>
            {" "}
            {t("timezoneDiffers", { viewer: viewerZone })}
          </>
        ) : null}
      </p>

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
                  "glowa-focus flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent",
                  disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                )}
              >
                <span className="text-[0.65rem] tracking-wide uppercase">
                  {dayFormatter.format(day.date)}
                </span>
                <span className="text-sm font-medium">
                  {dateFormatter.format(day.date)}
                </span>
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
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
          role="radiogroup"
          aria-label={t("chooseTime")}
        >
          {times.map((slot) => {
            const isSelected = value?.starts_at === slot.starts_at;
            return (
              <Button
                key={slot.starts_at}
                type="button"
                role="radio"
                aria-checked={isSelected}
                variant={isSelected ? "default" : "outline"}
                onClick={() => onChange(slot)}
              >
                {timeFormatter.format(new Date(slot.starts_at))}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
