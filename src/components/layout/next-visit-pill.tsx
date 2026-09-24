"use client";

import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { NextVisit } from "@/components/layout/use-account";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatTime, toZonedDateKey } from "@/lib/format";
import { addDaysToKey } from "@/lib/timezone";

/**
 * "Tomorrow 14:30" in the header, on every page, for anyone with a booking
 * coming up. The question customers otherwise answer by digging through
 * email; one tap opens the booking with its directions and cancel button.
 *
 * Times are on the salon's clock - the visit happens there, whatever
 * timezone the phone is in.
 */
export function NextVisitPill({ visit }: { visit: NextVisit }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  // "Today" and "tomorrow" depend on the viewer's clock, which the server
  // does not have; the pill renders after mount, so this is only a guard.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (now === null) return null;

  const options = { timeZone: visit.timezone, locale };
  const time = formatTime(visit.startsAt, options);
  const todayKey = toZonedDateKey(new Date(now), visit.timezone);
  const dayKey = toZonedDateKey(new Date(visit.startsAt), visit.timezone);

  const day =
    dayKey === todayKey
      ? t("today")
      : dayKey === addDaysToKey(todayKey, 1)
        ? t("tomorrow")
        : new Intl.DateTimeFormat(locale, {
            timeZone: visit.timezone,
            weekday: "short",
            day: "numeric",
            month: "short",
          }).format(new Date(visit.startsAt));

  const label = t("nextVisit", { when: `${day} ${time}`, business: visit.businessName });
  const soon = dayKey === todayKey;

  return (
    <Link
      href={`/bookings/${visit.id}`}
      aria-label={label}
      title={label}
      className="glowa-focus glowa-enter border-border/80 bg-background/70 hover:border-primary/40 hover:bg-primary/5 group relative inline-flex h-9 items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors sm:px-3"
    >
      <span className="relative flex size-4 items-center justify-center">
        <CalendarClock className="text-primary size-4" aria-hidden />
        {soon ? (
          <span className="bg-primary absolute -top-0.5 -right-0.5 size-1.5 rounded-full motion-safe:animate-ping" />
        ) : null}
      </span>
      <span className="hidden tabular-nums sm:inline">
        {day} · {time}
      </span>
      <span className="text-muted-foreground hidden max-w-[9rem] truncate lg:inline">
        {visit.businessName}
      </span>
    </Link>
  );
}
