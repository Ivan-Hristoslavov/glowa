import "server-only";

import type { BusinessCategory } from "@/lib/business-categories";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type SearchResult =
  Database["public"]["Functions"]["search_businesses"]["Returns"][number];

/**
 * Discovery is the same for everyone, so this uses the cookie-less client.
 * Reading cookies here would make the landing page and search dynamic, and
 * those are exactly the two pages that have to be cacheable.
 */
export async function searchBusinesses(params: {
  query?: string;
  category?: BusinessCategory;
  city?: string;
  limit?: number;
  offset?: number;
  maxPriceCents?: number;
  openOn?: string;
  sort?: "rating" | "price" | "name";
}) {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("search_businesses", {
    p_query: params.query?.trim() || undefined,
    p_category: params.category,
    p_city: params.city?.trim() || undefined,
    p_limit: params.limit ?? 24,
    p_offset: params.offset ?? 0,
    p_max_price_cents: params.maxPriceCents,
    p_open_on: params.openOn,
    p_sort: params.sort ?? "rating",
  });

  if (error) throw error;
  return data ?? [];
}

/** Every city that currently has an active business, for the filter menu. */
export async function listCities() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("locations")
    .select("city, businesses!inner(status)")
    .eq("is_active", true)
    .eq("businesses.status", "active")
    .not("city", "is", null);

  if (error) throw error;

  const cities = new Set<string>();
  for (const row of data ?? []) {
    if (row.city) cities.add(row.city);
  }
  return [...cities].sort((a, b) => a.localeCompare(b));
}

export async function getBusinessBySlug(slug: string) {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("businesses")
    .select(
      `
      id, slug, name, description, short_pitch, category, logo_url,
      cover_image_url, gallery, phone, email, website, currency, timezone,
      booking_policy, google_review_url, status,
      locations (
        id, name, address_line1, address_line2, city, region, postal_code,
        country_code, latitude, longitude, phone, is_primary, is_active,
        business_hours ( id, day_of_week, opens_at, closes_at )
      ),
      staff_profiles ( id, display_name, title, bio, avatar_url, color, is_bookable, sort_order ),
      services (
        id, name, description, category, duration_minutes, price_cents,
        currency, requires_deposit, deposit_cents, is_active, sort_order,
        service_staff ( staff_profile_id )
      )
    `,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [{ data: rating }, { data: reviews }] = await Promise.all([
    supabase
      .from("business_rating_summary")
      .select("average_rating, review_count")
      .eq("business_id", data.id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, business_response, responded_at, staff_profile_id")
      .eq("business_id", data.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    ...data,
    locations: (data.locations ?? [])
      .filter((location) => location.is_active)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
    staff_profiles: (data.staff_profiles ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
    services: (data.services ?? [])
      .filter((service) => service.is_active)
      .sort((a, b) => a.sort_order - b.sort_order),
    // The view returns nullable aggregates; normalise once here so every
    // consumer can treat the count as a number.
    rating: {
      average_rating: rating?.average_rating ?? null,
      review_count: rating?.review_count ?? 0,
    },
    reviews: reviews ?? [],
  };
}

export type BusinessDetail = NonNullable<
  Awaited<ReturnType<typeof getBusinessBySlug>>
>;

export async function getAvailableSlots(params: {
  serviceId: string;
  from: string;
  to: string;
  staffProfileId?: string | null;
  locationId?: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_service_id: params.serviceId,
    p_from: params.from,
    p_to: params.to,
    p_staff_profile_id: params.staffProfileId ?? undefined,
    p_location_id: params.locationId ?? undefined,
  });

  if (error) throw error;
  return data ?? [];
}

/**
 * Slugs of every live, non-demo salon, for `generateStaticParams`.
 *
 * Capped: a build should not try to prerender fifty thousand pages. Anything
 * past the cap is still served, just rendered on first request and cached
 * from then on.
 */
export async function listBusinessSlugs(limit = 2000) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("slug")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);

  // A build must not fail because the database was briefly unreachable; an
  // empty list just means every page is rendered on demand.
  if (error) return [];
  return (data ?? []).map((row) => row.slug);
}
