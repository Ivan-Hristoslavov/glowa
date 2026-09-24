import type { BusinessCategory } from "@/lib/business-categories";

/**
 * Generated imagery, in one place.
 *
 * Every file here was produced for GLOWA with OpenAI image generation against a
 * single art direction (warm daylight, cream and warm-neutral, muted coral and
 * sage, no text baked in), then converted to WebP. Provenance and the prompts
 * live in `docs/visual-assets.md`.
 *
 * Icons are deliberately *not* here - they are hand-drawn SVG in
 * `components/brand/feature-icons.tsx`, because a raster icon at 20px is mush
 * and cannot inherit `currentColor`.
 */
const BASE = "/brand";

export const brandAssets = {
  heroLight: `${BASE}/hero-salon-light.webp`,
  heroDark: `${BASE}/hero-salon-dark.webp`,
  heroMobile: `${BASE}/hero-mobile.webp`,
  heroBarber: `${BASE}/hero-barber.webp`,
  heroSpa: `${BASE}/hero-spa.webp`,
  /** Backdrop for the social share card; the wordmark is composited on top. */
  ogImage: `${BASE}/og-cover.webp`,
} as const;

/**
 * The showcase salon (`scripts/seed-showcase.sql`): its cover, portfolio and
 * team. Generated like the rest; the people depict nobody real.
 */
export const showcaseAssets = {
  cover: `${BASE}/showcase/showcase-cover.webp`,
  gallery: [1, 2, 3, 4, 5, 6].map((n) => `${BASE}/showcase/showcase-gallery-${n}.webp`),
  staff: [1, 2, 3, 4].map((n) => `${BASE}/showcase/showcase-staff-${n}.webp`),
} as const;

export const categoryImages = {
  hair: `${BASE}/category-hair.webp`,
  barber: `${BASE}/category-barber.webp`,
  nails: `${BASE}/category-nails.webp`,
  skincare: `${BASE}/category-skincare.webp`,
  lashes: `${BASE}/category-lashes.webp`,
  spa: `${BASE}/category-spa.webp`,
} as const;

/**
 * Feature illustrations. Larger than an icon and used where a surface is
 * introducing a capability rather than labelling a control.
 */
export const featureArt = {
  booking: `${BASE}/feature-booking.webp`,
  teamCalendar: `${BASE}/feature-calendar.webp`,
  clients: `${BASE}/feature-clients.webp`,
  payments: `${BASE}/feature-payments.webp`,
  reviews: `${BASE}/feature-reviews.webp`,
  marketing: `${BASE}/feature-marketing.webp`,
  analytics: `${BASE}/feature-analytics.webp`,
  assistant: `${BASE}/feature-assistant.webp`,
  reminders: `${BASE}/feature-reminders.webp`,
  growth: `${BASE}/feature-growth.webp`,
} as const;

/**
 * Empty-state art. Each state has a light and a dark version drawn for its own
 * background rather than one image dimmed by CSS, matching how the two themes
 * are treated everywhere else.
 */
export const emptyStateArt = {
  bookings: { light: `${BASE}/empty-bookings.webp`, dark: `${BASE}/empty-bookings-dark.webp` },
  calendar: { light: `${BASE}/empty-calendar.webp`, dark: `${BASE}/empty-calendar-dark.webp` },
  clients: { light: `${BASE}/empty-clients.webp`, dark: `${BASE}/empty-clients-dark.webp` },
  campaigns: { light: `${BASE}/empty-campaigns.webp`, dark: `${BASE}/empty-campaigns-dark.webp` },
  /** Only one version: it appears on a coral-washed surface in both themes. */
  onboarding: { light: `${BASE}/empty-onboarding.webp`, dark: `${BASE}/empty-onboarding.webp` },
} as const;

export type EmptyStateArt = (typeof emptyStateArt)[keyof typeof emptyStateArt];

/** Cover art for the seeded demo salons, keyed by slug. */
export const demoCovers: Record<string, string> = {
  "demo-hair-lab-sofia": `${BASE}/cover-hair-lab.webp`,
  "demo-black-scissors": `${BASE}/cover-black-scissors.webp`,
  "demo-bloom-nails": `${BASE}/cover-bloom-nails.webp`,
};

const CATEGORY_TO_IMAGE: Partial<Record<BusinessCategory, keyof typeof categoryImages>> = {
  hair_salon: "hair",
  barbershop: "barber",
  nail_studio: "nails",
  lash_brow: "lashes",
  skincare: "skincare",
  makeup: "skincare",
  massage: "spa",
  spa: "spa",
};

/**
 * A stand-in image for a business that has not uploaded its own. Returns null
 * for categories with no matching photograph rather than showing something
 * misleading - the caller falls back to the brand gradient.
 */
export function fallbackBusinessImage(
  category: BusinessCategory,
  slug?: string,
): string | null {
  if (slug && demoCovers[slug]) return demoCovers[slug];
  const key = CATEGORY_TO_IMAGE[category];
  return key ? categoryImages[key] : null;
}
