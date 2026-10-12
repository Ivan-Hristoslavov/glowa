import { BUSINESS_CATEGORIES, type BusinessCategory } from "@/lib/business-categories";
import { PLACES, findPlace, type Place } from "@/lib/places";

/**
 * Service × town landing pages (`/salons/hair-salon/sofia`): the pages people
 * actually search for ("фризьор София"). The URL uses hyphens for the category
 * and the town's id from `places.ts`, both stable and readable.
 */
export const LANDING_CATEGORIES = BUSINESS_CATEGORIES.filter(
  (category) => category !== "other",
);

export function categoryToSlug(category: BusinessCategory) {
  return category.replace(/_/g, "-");
}

export function categoryFromSlug(slug: string): BusinessCategory | null {
  const match = LANDING_CATEGORIES.find((category) => categoryToSlug(category) === slug);
  return match ?? null;
}

export function landingPlace(id: string): Place | null {
  return findPlace(id);
}

export function landingPath(category: BusinessCategory, place: Place) {
  return `/salons/${categoryToSlug(category)}/${place.id}`;
}

/** The towns offered as neighbours on a landing page: the largest in the country. */
export function topPlaces(country: Place["country"], limit = 8) {
  return PLACES.filter((place) => place.country === country).slice(0, limit);
}

/**
 * "in {town}" as the language wants it. Bulgarian takes "във" before words that
 * start with в or ф ("във Варна", "във Враца"), "в" otherwise.
 */
export function inPreposition(locale: string, townName: string) {
  if (locale === "bg") return /^[вфВФ]/.test(townName) ? "във" : "в";
  return locale === "ro" ? "în" : "in";
}
