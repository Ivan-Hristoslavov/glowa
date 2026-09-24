"use client";

import { ArrowRight, CalendarDays, Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { bg, enGB, ro } from "react-day-picker/locale";

import {
  PlacePicker,
  placeParams,
  usePlaceLabel,
  type PlaceValue,
} from "@/components/discovery/place-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { coarsen } from "@/lib/places";
import { cn } from "@/lib/utils";

const PICKER_LOCALES = { bg, en: enGB, ro } as const;

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * The landing page's one job: what, where, when - then go.
 *
 * Each field says what it is above what it holds, so nobody has to guess
 * what an empty box wants. Under it, the three searches people make most
 * often are one tap each: near me, today, tomorrow.
 */
type HeroSearchProps = {
  /** "hero" on the landing page; "bar" at the top of the results. */
  variant?: "hero" | "bar";
  /** What the results page was opened with, so the bar shows it. */
  initial?: { q?: string; place?: PlaceValue; day?: string };
  /** Filters set elsewhere on the page that a new search should keep. */
  keep?: Record<string, string>;
};

function keyToDate(key: string | undefined) {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function HeroSearch({ variant = "hero", initial, keep }: HeroSearchProps = {}) {
  const t = useTranslations("home.search");
  const places = useTranslations("places");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(initial?.q ?? "");
  const [place, setPlace] = useState<PlaceValue>(initial?.place ?? null);
  const [day, setDay] = useState<Date | null>(() => keyToDate(initial?.day));
  const [dayOpen, setDayOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const placeLabel = usePlaceLabel(place);

  const dayLabel = day
    ? new Intl.DateTimeFormat(localeHrefLang[locale], {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(day)
    : null;

  function go(next: { place?: PlaceValue; day?: Date | null } = {}) {
    const chosenPlace = next.place !== undefined ? next.place : place;
    const chosenDay = next.day !== undefined ? next.day : day;
    const params = new URLSearchParams(keep);
    if (query.trim()) params.set("q", query.trim());
    for (const [key, value] of Object.entries(placeParams(chosenPlace))) {
      params.set(key, value);
    }
    if (chosenDay) params.set("openOn", toKey(chosenDay));
    startTransition(() => {
      router.push(`/search${params.size ? `?${params.toString()}` : ""}`);
    });
  }

  function nearMe() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next: PlaceValue = {
          kind: "near",
          lat: coarsen(position.coords.latitude),
          lng: coarsen(position.coords.longitude),
        };
        setPlace(next);
        go({ place: next });
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  const field =
    "glowa-focus flex min-w-0 flex-col items-start gap-0.5 rounded-[1.4rem] px-5 py-3 text-left transition-colors hover:bg-muted/70";
  const label = "text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase";

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go();
        }}
        role="search"
        className="bg-card grid gap-1 rounded-[1.9rem] border p-2 shadow-[var(--shadow-pop)] md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
      >
        <label className={cn(field, "cursor-text")}>
          <span className={label}>{t("whatLabel")}</span>
          <span className="flex w-full items-center gap-2">
            <Search className="text-primary size-4 shrink-0" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("what")}
              className="placeholder:text-muted-foreground/80 w-full min-w-0 bg-transparent text-[0.95rem] font-medium outline-none"
            />
          </span>
        </label>

        <PlacePicker value={place} onChange={setPlace} className={field}>
          <span className={label}>{t("whereLabel")}</span>
          <span className="flex w-full items-center gap-2">
            <MapPin className="text-primary size-4 shrink-0" aria-hidden />
            <span
              className={cn(
                "truncate text-[0.95rem] font-medium",
                !placeLabel && "text-muted-foreground/80",
              )}
            >
              {placeLabel ?? t("where")}
            </span>
          </span>
        </PlacePicker>

        <Popover open={dayOpen} onOpenChange={setDayOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={field}>
              <span className={label}>{t("whenLabel")}</span>
              <span className="flex w-full items-center gap-2">
                <CalendarDays className="text-primary size-4 shrink-0" aria-hidden />
                <span
                  className={cn(
                    "truncate text-[0.95rem] font-medium first-letter:uppercase",
                    !dayLabel && "text-muted-foreground/80",
                  )}
                >
                  {dayLabel ?? t("anyTime")}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto rounded-2xl p-2">
            <Calendar
              mode="single"
              locale={PICKER_LOCALES[locale]}
              weekStartsOn={1}
              selected={day ?? undefined}
              disabled={{ before: new Date() }}
              onSelect={(date) => {
                setDay(date ?? null);
                setDayOpen(false);
              }}
            />
            {day ? (
              <button
                type="button"
                onClick={() => {
                  setDay(null);
                  setDayOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground w-full rounded-lg py-2 text-sm"
              >
                {t("anyTime")}
              </button>
            ) : null}
          </PopoverContent>
        </Popover>

        <button
          type="submit"
          disabled={isPending}
          className="glowa-focus bg-primary text-primary-foreground hover:bg-primary/90 flex h-14 items-center justify-center gap-2 rounded-[1.4rem] px-7 text-base font-semibold shadow-[0_10px_30px_-10px_var(--primary)] transition-all hover:-translate-y-px md:ml-1"
        >
          {isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Search className="size-5" aria-hidden />
          )}
          <span>{t("submit")}</span>
        </button>
      </form>

      <div className={cn("mt-4 flex flex-wrap items-center gap-2", variant === "bar" && "hidden")}>
        <span className="text-muted-foreground mr-1 text-sm">{t("quick")}</span>
        <button
          type="button"
          onClick={nearMe}
          disabled={locating}
          className="glowa-focus bg-card hover:border-primary/50 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
        >
          {locating ? (
            <Loader2 className="text-primary size-3.5 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className="text-primary size-3.5" aria-hidden />
          )}
          {places("nearMe")}
        </button>
        {[
          { label: t("today"), days: 0 },
          { label: t("tomorrow"), days: 1 },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => {
              const next = inDays(option.days);
              setDay(next);
              go({ day: next });
            }}
            className="glowa-focus bg-card hover:border-primary/50 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
          >
            {option.label}
            <ArrowRight className="text-muted-foreground size-3.5" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
