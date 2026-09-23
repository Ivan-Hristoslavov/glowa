import type { Locale } from "@/i18n/routing";
import { localeHrefLang, routing } from "@/i18n/routing";
import { fallbackBusinessImage } from "@/lib/brand-assets";
import type { BusinessCategory } from "@/lib/business-categories";
import { publicEnv } from "@/lib/env";
import { pickLocalized } from "@/lib/localized";
import type { BusinessDetail } from "@/lib/queries/discovery";

const SITE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/**
 * Schema.org for salon pages.
 *
 * This is what decides whether a salon shows up in search with its hours,
 * price range and rating, or as a bare blue link. Everything emitted here is
 * read from the row - nothing is invented, and in particular `aggregateRating`
 * is omitted entirely when there are no reviews rather than shipped as zero,
 * which Google treats as a violation and which would be a lie anyway.
 */

/** Schema.org expects `Mo`, `Tu`, … and the DB stores 0 = Sunday. */
const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * The closest schema.org type per category. `HealthAndBeautyBusiness` is the
 * umbrella; the specific ones below are the subtypes Google recognises.
 */
const CATEGORY_TYPE: Record<BusinessCategory, string> = {
  hair_salon: "HairSalon",
  barbershop: "HairSalon",
  nail_studio: "NailSalon",
  lash_brow: "BeautySalon",
  skincare: "BeautySalon",
  makeup: "BeautySalon",
  massage: "DaySpa",
  spa: "DaySpa",
  tattoo: "TattooParlor",
  other: "HealthAndBeautyBusiness",
};

export function businessJsonLd(
  business: BusinessDetail,
  locale: Locale,
): Record<string, unknown> {
  const url = `${SITE}/${locale}/business/${business.slug}`;
  const location = business.locations[0] ?? null;
  const services = business.services;

  const prices = services.map((service) => service.price_cents).filter((n) => n > 0);

  const openingHours = (location?.business_hours ?? [])
    .filter((row) => row.opens_at && row.closes_at)
    .map((row) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[row.day_of_week] ?? "Monday"}`,
      opens: String(row.opens_at).slice(0, 5),
      closes: String(row.closes_at).slice(0, 5),
    }));

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": CATEGORY_TYPE[business.category] ?? "HealthAndBeautyBusiness",
    "@id": url,
    name: business.name,
    url,
    description: pickLocalized(business.short_pitch, locale, "") || undefined,
    // Same fallback chain the social card uses: a salon without its own photo
    // still gets an illustration rather than no image at all.
    image: absolute(
      business.cover_image_url ??
        fallbackBusinessImage(business.category, business.slug),
    ),
    logo: absolute(business.logo_url),
    telephone: business.phone ?? location?.phone ?? undefined,
    email: business.email ?? undefined,
    currenciesAccepted: business.currency,
    // `potentialAction` is what lets Google surface a Book button.
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/book`,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/MobileWebPlatform",
        ],
      },
      result: { "@type": "Reservation", name: business.name },
    },
  };

  if (location) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress:
        [location.address_line1, location.address_line2].filter(Boolean).join(", ") ||
        undefined,
      addressLocality: location.city ?? undefined,
      addressRegion: location.region ?? undefined,
      postalCode: location.postal_code ?? undefined,
      addressCountry: location.country_code,
    };

    if (location.latitude !== null && location.longitude !== null) {
      data.geo = {
        "@type": "GeoCoordinates",
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }
  }

  if (openingHours.length) data.openingHoursSpecification = openingHours;

  if (prices.length) {
    // A band, because the cheapest service is what people compare - but a
    // salon with one price should not be advertised as "30–30".
    const low = Math.min(...prices) / 100;
    const high = Math.max(...prices) / 100;
    data.priceRange =
      low === high
        ? `${low} ${business.currency}`
        : `${low}–${high} ${business.currency}`;
  }

  // Only when there is something real to report. An invented or zeroed rating
  // is both a Google policy violation and exactly the kind of fake traction
  // this product refuses to ship.
  if (business.rating.review_count > 0 && business.rating.average_rating !== null) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(business.rating.average_rating).toFixed(1),
      reviewCount: business.rating.review_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (services.length) {
    data.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: business.name,
      itemListElement: services.slice(0, 50).map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: pickLocalized(service.name, locale, ""),
          description: pickLocalized(service.description, locale, "") || undefined,
        },
        price: (service.price_cents / 100).toFixed(2),
        priceCurrency: service.currency,
        availability: "https://schema.org/InStock",
      })),
    };
  }

  return prune(data);
}

/** Breadcrumbs give the salon page a labelled path in the result instead of a raw URL. */
export function breadcrumbJsonLd(
  locale: Locale,
  trail: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: `${SITE}/${locale}${entry.path}`,
    })),
  };
}

export function organizationJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GLOWA",
    url: `${SITE}/${locale}`,
    logo: `${SITE}/brand/og-cover.webp`,
  };
}

/**
 * Every page needs the full alternate set, and a child route that sets its own
 * `alternates.canonical` drops the inherited `languages`. This rebuilds both
 * together so the two can never drift apart again.
 */
export function alternatesFor(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  return {
    canonical: path,
    languages: {
      ...Object.fromEntries(
        routing.locales.map((value) => [
          localeHrefLang[value],
          `/${value}${stripLocale(path)}`,
        ]),
      ),
      // Tells a search engine which version to show when no language matches.
      "x-default": `/${routing.defaultLocale}${stripLocale(path)}`,
    },
  };
}

function stripLocale(path: string) {
  const match = path.match(/^\/(bg|en|ro)(\/.*)?$/);
  return match ? (match[2] ?? "") : path;
}

/** Schema.org wants absolute URLs; brand assets are stored site-relative. */
function absolute(url: string | null | undefined) {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${SITE}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Drops undefined values so the emitted JSON stays free of empty keys. */
function prune<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}
