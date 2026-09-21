import { localeHrefLang, type Locale } from "@/i18n/routing";

/** Money is stored in minor units everywhere; only formatting converts it. */
export function formatPrice(
  cents: number | null | undefined,
  currency: string,
  locale: Locale,
) {
  if (cents == null) return null;
  return new Intl.NumberFormat(localeHrefLang[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDuration(minutes: number, locale: Locale) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = new Intl.NumberFormat(localeHrefLang[locale]);
  if (hours && rest) return `${parts.format(hours)} h ${parts.format(rest)} min`;
  if (hours) return `${parts.format(hours)} h`;
  return `${parts.format(rest)} min`;
}

type ZonedOptions = { timeZone: string; locale: Locale };

export function formatTime(iso: string, { timeZone, locale }: ZonedOptions) {
  return new Intl.DateTimeFormat(localeHrefLang[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function formatDate(iso: string, { timeZone, locale }: ZonedOptions) {
  return new Intl.DateTimeFormat(localeHrefLang[locale], {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, options: ZonedOptions) {
  return `${formatDate(iso, options)}, ${formatTime(iso, options)}`;
}

/**
 * The timezone, spelled out. Booking across zones is confusing unless the app
 * says which clock it is using, so every schedule surface shows this.
 */
export function formatZoneLabel(iso: string, { timeZone, locale }: ZonedOptions) {
  const parts = new Intl.DateTimeFormat(localeHrefLang[locale], {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(new Date(iso));
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

/** The viewer's own zone, so we can warn when it differs from the salon's. */
export function resolveViewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** `YYYY-MM-DD` for a given instant in a given zone — the key the API uses. */
export function toZonedDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
