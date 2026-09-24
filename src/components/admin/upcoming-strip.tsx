"use client";

import { CalendarDays, Clock, Phone, Plus, Scissors, StickyNote, User2 } from "lucide-react";
import { m } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime, toZonedDateKey } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import type { UpcomingAppointment } from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type UpcomingStripProps = {
  businessId: string;
  timezone: string;
  locale: Locale;
  appointments: UpcomingAppointment[];
};

/**
 * Who is next, on every admin page - the question a front desk asks forty
 * times a day, answered without opening the calendar.
 *
 * Laid out like stories: a ring per appointment in the stylist's colour, the
 * time under it, tap for the details and a call button. The one in progress
 * pulses. It subscribes to the same realtime feed as the calendar, so a
 * booking made online appears here while the owner is on another page.
 */
export function UpcomingStrip({ businessId, timezone, locale, appointments }: UpcomingStripProps) {
  const t = useTranslations("admin.upcoming");
  const router = useRouter();
  // null until mounted: the server's clock and the browser's differ, and a
  // relative time rendered on both would not match.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`upcoming:${businessId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `business_id=eq.${businessId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  const zoned = { timeZone: timezone, locale };
  const todayKey = now ? toZonedDateKey(new Date(now), timezone) : null;
  const visible = now
    ? appointments.filter((item) => new Date(item.ends_at).getTime() > now)
    : appointments;

  function relative(item: UpcomingAppointment) {
    if (!now) return null;
    const start = new Date(item.starts_at).getTime();
    if (start <= now) return t("now");
    const minutes = Math.round((start - now) / 60_000);
    if (minutes < 60) return t("inMinutes", { minutes });
    if (minutes < 60 * 12) return t("inHours", { hours: Math.floor(minutes / 60) });
    return null;
  }

  return (
    <div className="border-border/70 bg-background/60 border-b backdrop-blur-md">
      <div className="flex items-center gap-3 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        <p className="text-muted-foreground hidden shrink-0 text-[0.65rem] font-semibold tracking-[0.16em] uppercase sm:block">
          {t("title")}
        </p>

        {/* The first bubble adds one, the way "your story" does. */}
        <Link
          href="/dashboard/calendar"
          className="glowa-focus group flex w-14 shrink-0 flex-col items-center gap-1 rounded-xl"
          aria-label={t("add")}
        >
          <span className="border-primary/50 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-10 items-center justify-center rounded-full border-2 border-dashed transition-colors">
            <Plus className="size-4" aria-hidden />
          </span>
          <span className="text-muted-foreground text-[0.65rem] leading-none">{t("addShort")}</span>
        </Link>

        {visible.length === 0 ? (
          <p className="text-muted-foreground shrink-0 text-xs">{t("empty")}</p>
        ) : null}

        {visible.map((item, index) => {
          const dayKey = toZonedDateKey(new Date(item.starts_at), timezone);
          const previousKey =
            index > 0 ? toZonedDateKey(new Date(visible[index - 1].starts_at), timezone) : todayKey;
          const newDay = previousKey !== null && dayKey !== previousKey;
          const inProgress = now !== null && new Date(item.starts_at).getTime() <= now;
          const color = item.staff_profiles?.color ?? "#d96c61";
          const name = item.customer_name?.trim() || t("walkIn");
          const initials = name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join("");
          const service =
            pickLocalized(item.services?.name, locale) ||
            pickLocalized(item.service_name_snapshot, locale);
          const soon = relative(item);

          return (
            <div key={item.id} className="flex shrink-0 items-center gap-3">
              {newDay ? (
                <span className="text-muted-foreground border-border/70 flex h-10 items-center border-l pl-3 text-[0.65rem] font-semibold tracking-wide uppercase">
                  {dayKey === (todayKey ? addDayKey(todayKey) : null)
                    ? t("tomorrow")
                    : formatDate(item.starts_at, zoned)}
                </span>
              ) : null}
              <Popover>
                <PopoverTrigger asChild>
                  <m.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index, 10) * 0.035, duration: 0.3 }}
                    className="glowa-focus group flex w-14 flex-col items-center gap-1 rounded-xl"
                    aria-label={`${formatTime(item.starts_at, zoned)} · ${name}${service ? ` · ${service}` : ""}`}
                  >
                    <span
                      className={cn(
                        "relative rounded-full p-[2px] transition-transform duration-300 group-hover:scale-105",
                        item.status === "pending" && "opacity-80",
                      )}
                      style={{
                        background:
                          item.status === "pending"
                            ? `repeating-conic-gradient(${color} 0 18deg, transparent 18deg 30deg)`
                            : `conic-gradient(from 200deg, ${color}, var(--glowa-coral), ${color})`,
                      }}
                    >
                      {inProgress ? (
                        <span
                          aria-hidden
                          className="absolute inset-0 animate-ping rounded-full opacity-40"
                          style={{ background: color }}
                        />
                      ) : null}
                      <span className="bg-card border-background relative flex size-9 items-center justify-center rounded-full border-2 text-[0.7rem] font-semibold">
                        {initials}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-[0.68rem] leading-none font-semibold tabular-nums",
                        inProgress && "text-primary",
                      )}
                    >
                      {inProgress ? t("now") : formatTime(item.starts_at, zoned)}
                    </span>
                  </m.button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{name}</p>
                      {service ? (
                        <p className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                          <Scissors className="size-3" aria-hidden />
                          {service}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                        item.status === "pending"
                          ? "bg-warning/15 text-warning"
                          : "bg-success/15 text-success",
                      )}
                    >
                      {t(`status.${item.status}`)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="text-muted-foreground size-3.5" aria-hidden />
                      <span className="tabular-nums">
                        {formatDate(item.starts_at, zoned)}, {formatTime(item.starts_at, zoned)}–
                        {formatTime(item.ends_at, zoned)}
                        {soon ? <span className="text-primary ml-1.5 text-xs font-medium">{soon}</span> : null}
                      </span>
                    </div>
                    {item.staff_profiles?.display_name ? (
                      <div className="flex items-center gap-2">
                        <User2 className="text-muted-foreground size-3.5" aria-hidden />
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: color }} />
                          {item.staff_profiles.display_name}
                        </span>
                      </div>
                    ) : null}
                    {item.customer_notes ? (
                      <div className="flex items-start gap-2">
                        <StickyNote className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span className="text-muted-foreground line-clamp-3 text-xs">{item.customer_notes}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {item.customer_phone ? (
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <a href={`tel:${item.customer_phone}`}>
                          <Phone className="size-3.5" aria-hidden />
                          {t("call")}
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/dashboard/calendar?view=day&date=${dayKey}`}>
                        <CalendarDays className="size-3.5" aria-hidden />
                        {t("open")}
                      </Link>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The next calendar day of a YYYY-MM-DD key. */
function addDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}
