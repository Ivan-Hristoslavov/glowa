import type { Database } from "@/types/database";

export type BusinessCategory = Database["public"]["Enums"]["business_category"];
export type ServiceCategory = Database["public"]["Enums"]["service_category"];

/**
 * Client and server both need these, so they live outside the `server-only`
 * query module.
 */
export const BUSINESS_CATEGORIES = [
  "hair_salon",
  "barbershop",
  "nail_studio",
  "lash_brow",
  "skincare",
  "makeup",
  "massage",
  "spa",
  "tattoo",
  "other",
] as const satisfies readonly BusinessCategory[];

export function isBusinessCategory(value: unknown): value is BusinessCategory {
  return (
    typeof value === "string" &&
    (BUSINESS_CATEGORIES as readonly string[]).includes(value)
  );
}
