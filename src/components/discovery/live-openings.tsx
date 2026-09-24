"use client";

import { ArrowRight, MapPin } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { formatDuration, formatPrice } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import type { Opening } from "@/lib/queries/openings";
import { zonedDateKey } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type Day = "today" | "tomorrow";
type Shown = Opening & { day: Day };

/** Anything starting sooner than this is too late to walk to. */
const TOO_SOON_MS = 15 * 60 * 1000;

function label(openings: Opening[]): Shown[] {
  const now = Date.now();
  return openings.flatMap((opening) => {
    const start = new Date(opening.startsAt);
    if (start.getTime() < now + TOO_SOON_MS) return [];
    const today = zonedDateKey(new Date(now), opening.timezone);
    const tomorrow = zonedDateKey(new Date(now + 24 * 60 * 60 * 1000), opening.timezone);
    const key = zonedDateKey(start, opening.timezone);
    const day: Day | null = key === today ? "today" : key === tomorrow ? "tomorrow" : null;
    return day ? [{ ...opening, day }] : [];
  });
}

/**
 * Free times at real salons, today and tomorrow, one tap from booked.
 *
 * Nobody else leads with this: most booking sites make you pick a salon, then
 * a service, then hunt a calendar. Here the times come first - for the evening
 * someone decided, at lunch, to get their nails done. Each card goes straight
 * to the confirm step with the slot already chosen.
 *
 * Fetched after paint from a two-minute cache, so the landing page stays
 * static and the times stay fresh; the section simply does not appear when
 * there is nothing to show.
 */
export function LiveOpenings() {
  const t = useTranslations("home.openings");
  const locale = useLocale() as Locale;
  const [openings, setOpenings] = useState<Shown[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/openings")
      .then((response) => (response.ok ? response.json() : { openings: [] }))
      .then((body: { openings?: Opening[] }) => {
        if (active) setOpenings(label(body.openings ?? []));
      })
      .catch(() => {
        if (active) setOpenings([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (openings !== null && openings.length === 0) return null;

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6"
      aria-labelledby="openings-title"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-primary inline-flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex size-2.5" aria-hidden>
              <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60" />
              <span className="bg-primary relative inline-flex size-2.5 rounded-full" />
            </span>
            {t("live")}
          </p>
          <h2 id="openings-title" className="font-heading mt-2 text-3xl sm:text-4xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>
      </div>

      <ul
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-1 pb-4 sm:mx-0 sm:px-0"
        aria-busy={openings === null}
      >
        {openings === null
          ? Array.from({ length: 4 }, (_, index) => (
              <li
                key={index}
                className="bg-muted/70 h-36 w-[19.5rem] shrink-0 animate-pulse rounded-3xl"
              />
            ))
          : openings.map((opening) => (
              <li key={`${opening.slug}-${opening.startsAt}`} className="shrink-0 snap-start">
                <OpeningTicket opening={opening} locale={locale} />
              </li>
            ))}
      </ul>
    </section>
  );
}

function OpeningTicket({ opening, locale }: { opening: Shown; locale: Locale }) {
  const t = useTranslations("home.openings");
  const time = new Intl.DateTimeFormat(localeHrefLang[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: opening.timezone,
  }).format(new Date(opening.startsAt));
  const service = pickLocalized(opening.serviceName, locale);
  const params = new URLSearchParams({ service: opening.serviceId, at: opening.startsAt });
  if (opening.staffProfileId) params.set("staff", opening.staffProfileId);

  return (
    <Link
      href={`/business/${opening.slug}/book?${params.toString()}`}
      data-glow
      className="glowa-focus glowa-glow group bg-card relative flex h-36 w-[19.5rem] overflow-hidden rounded-3xl border shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
      aria-label={t("ticketLabel", {
        day: t(opening.day),
        time,
        service,
        salon: opening.businessName,
      })}
    >
      {/* The stub: the time, as large as a boarding-pass gate. */}
      <div
        className={cn(
          "relative flex w-[6.5rem] shrink-0 flex-col items-center justify-center",
          opening.day === "today" ? "bg-primary text-primary-foreground" : "bg-brand-peach",
        )}
      >
        <span className="text-[0.7rem] font-semibold tracking-wider uppercase opacity-80">
          {t(opening.day)}
        </span>
        <span className="font-heading mt-0.5 text-[1.7rem] leading-none tabular-nums">{time}</span>
      </div>

      {/* Perforation: a dashed seam with a notch bitten out top and bottom. */}
      <span
        aria-hidden
        className="border-border absolute inset-y-3 left-[6.5rem] border-l-2 border-dashed"
      />
      <span
        aria-hidden
        className="bg-background absolute -top-2.5 left-[calc(6.5rem-0.625rem)] size-5 rounded-full border"
      />
      <span
        aria-hidden
        className="bg-background absolute -bottom-2.5 left-[calc(6.5rem-0.625rem)] size-5 rounded-full border"
      />

      <div className="flex min-w-0 flex-1 flex-col justify-between py-3.5 pr-4 pl-5">
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] leading-snug font-semibold">{service}</p>
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
            {formatDuration(opening.durationMinutes, locale)} ·{" "}
            {formatPrice(opening.priceCents, opening.currency, locale)}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {opening.coverUrl ? (
            <span className="relative size-8 shrink-0 overflow-hidden rounded-full border">
              <Image src={opening.coverUrl} alt="" fill sizes="2rem" className="object-cover" />
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{opening.businessName}</span>
            {opening.city ? (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <MapPin className="size-3" aria-hidden />
                <span className="truncate">{opening.city}</span>
              </span>
            ) : null}
          </span>
          <span className="bg-foreground text-background flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-0.5">
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
