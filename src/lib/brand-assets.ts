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
} as const;

export const categoryImages = {
  hair: `${BASE}/category-hair.webp`,
  barber: `${BASE}/category-barber.webp`,
  nails: `${BASE}/category-nails.webp`,
  skincare: `${BASE}/category-skincare.webp`,
  lashes: `${BASE}/category-lashes.webp`,
  spa: `${BASE}/category-spa.webp`,
} as const;

export const emptyStateArt = {
  bookings: `${BASE}/empty-bookings.webp`,
  calendar: `${BASE}/empty-calendar.webp`,
  clients: `${BASE}/empty-clients.webp`,
  campaigns: `${BASE}/empty-campaigns.webp`,
} as const;

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
