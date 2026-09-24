import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Regenerated hourly. A salon that goes live should be crawlable the same
 * afternoon, but not at the cost of a database query per crawler hit.
 */
export const revalidate = 3600;

const BASE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/** Public routes worth crawling. Everything behind auth is deliberately absent. */
const STATIC_PATHS = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/search", priority: 0.8, changeFrequency: "daily" as const },
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/for-business", priority: 0.8, changeFrequency: "monthly" as const },
];

/**
 * Every URL carries the full set of `hreflang` alternates, because a Bulgarian
 * salon page and its Romanian translation are the same page - without the
 * alternates a search engine treats them as competing duplicates.
 */
function alternates(path: string) {
  return {
    languages: Object.fromEntries(
      routing.locales.map((locale) => [locale, `${BASE}/${locale}${path}`]),
    ),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const { path, priority, changeFrequency } of STATIC_PATHS) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${BASE}/${locale}${path}`,
        changeFrequency,
        priority,
        alternates: alternates(path),
      });
    }
  }

  // `anon` can read active businesses and nothing else, so this needs no
  // filtering of its own beyond excluding the seeded demo salons.
  const supabase = createPublicClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("slug, updated_at")
    .eq("status", "active")
    .eq("is_demo", false)
    .order("updated_at", { ascending: false })
    .limit(20_000);

  // A sitemap that 500s is worse than one listing only the static pages.
  if (error || !businesses) return entries;

  for (const business of businesses) {
    const path = `/business/${business.slug}`;
    for (const locale of routing.locales) {
      entries.push({
        url: `${BASE}/${locale}${path}`,
        lastModified: business.updated_at
          ? new Date(business.updated_at)
          : undefined,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: alternates(path),
      });
    }
  }

  return entries;
}
