import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

/**
 * Business-authored content is stored as {"bg": …, "en": …, "ro": …} jsonb.
 * Reads come back as `Json`, so narrow before use rather than casting.
 */
export type LocalizedText = Partial<Record<Locale, string>>;

export function isLocalizedText(value: unknown): value is LocalizedText {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Falls back to the default locale, then to any populated translation, so a
 * partially translated salon never renders a blank name.
 */
export function pickLocalized(
  value: unknown,
  locale: Locale,
  fallback = "",
): string {
  if (typeof value === "string") return value;
  if (!isLocalizedText(value)) return fallback;

  const exact = value[locale];
  if (typeof exact === "string" && exact.trim()) return exact;

  const preferred = value[routing.defaultLocale];
  if (typeof preferred === "string" && preferred.trim()) return preferred;

  for (const candidate of Object.values(value)) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  return fallback;
}
