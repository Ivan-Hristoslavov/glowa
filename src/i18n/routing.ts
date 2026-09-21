import { defineRouting } from "next-intl/routing";

/**
 * GLOWA ships Bulgarian, English and Romanian from day one.
 * Bulgarian is the default market; every locale is prefixed so that
 * canonical URLs, hreflang tags and analytics stay unambiguous.
 */
export const routing = defineRouting({
  locales: ["bg", "en", "ro"],
  defaultLocale: "bg",
  localePrefix: "always",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const localeLabels: Record<Locale, string> = {
  bg: "Български",
  en: "English",
  ro: "Română",
};

/** BCP-47 tags used for `lang`, Intl formatting and hreflang. */
export const localeHrefLang: Record<Locale, string> = {
  bg: "bg-BG",
  en: "en-GB",
  ro: "ro-RO",
};

/** Default currency per market. Overridden per business once set up. */
export const localeCurrency: Record<Locale, string> = {
  bg: "BGN",
  en: "EUR",
  ro: "RON",
};
