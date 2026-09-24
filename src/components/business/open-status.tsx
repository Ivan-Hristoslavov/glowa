"use client";

import { useTranslations } from "next-intl";

import { zonedMinutes } from "@/lib/timezone";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

export type OpeningHours = Array<{ day: number; opens: string; closes: string }>;

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** Day of week (0 = Sunday) at the salon, not wherever the visitor is. */
function zonedDow(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/**
 * "Open now, until 19:00" - in the salon's own timezone.
 *
 * The salon page is cached for an hour, so "open" cannot be decided on the
 * server: it would be an hour stale at worst. This island works it out in
 * the browser from the published hours and says nothing until it knows.
 */
export function OpenStatus({
  hours,
  timezone,
  weekdays,
  className,
}: {
  hours: OpeningHours;
  timezone: string;
  /** Localised weekday names, index 0 = Sunday. */
  weekdays: string[];
  className?: string;
}) {
  const t = useTranslations("business");
  const now = useNow();
  if (now === null || hours.length === 0) return null;

  const date = new Date(now);
  const today = zonedDow(date, timezone);
  const minutes = zonedMinutes(date, timezone);

  const todays = hours
    .filter((range) => range.day === today)
    .sort((a, b) => a.opens.localeCompare(b.opens));
  const current = todays.find(
    (range) => minutes >= toMinutes(range.opens) && minutes < toMinutes(range.closes),
  );

  if (current) {
    const closingSoon = toMinutes(current.closes) - minutes <= 60;
    return (
      <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
        <span className="relative flex size-2">
          <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          <span className="bg-success relative inline-flex size-2 rounded-full" />
        </span>
        <span className="text-success font-medium">{t("openNow")}</span>
        <span className="text-muted-foreground">
          {closingSoon
            ? t("closesSoon", { time: current.closes.slice(0, 5) })
            : t("closesAt", { time: current.closes.slice(0, 5) })}
        </span>
      </span>
    );
  }

  // Next opening: later today, or the next day that has hours.
  let next: { day: number; time: string } | null = null;
  const laterToday = todays.find((range) => toMinutes(range.opens) > minutes);
  if (laterToday) {
    next = { day: today, time: laterToday.opens.slice(0, 5) };
  } else {
    for (let offset = 1; offset <= 7 && !next; offset += 1) {
      const day = (today + offset) % 7;
      const first = hours
        .filter((range) => range.day === day)
        .sort((a, b) => a.opens.localeCompare(b.opens))[0];
      if (first) next = { day, time: first.opens.slice(0, 5) };
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className="bg-muted-foreground/60 size-2 rounded-full" aria-hidden />
      <span className="font-medium">{t("closedNow")}</span>
      {next ? (
        <span className="text-muted-foreground">
          {next.day === today
            ? t("opensToday", { time: next.time })
            : next.day === (today + 1) % 7
              ? t("opensTomorrow", { time: next.time })
              : t("opensOn", { day: weekdays[next.day] ?? "", time: next.time })}
        </span>
      ) : null}
    </span>
  );
}
