import "server-only";

import { fallbackBusinessImage } from "@/lib/brand-assets";
import { searchBusinesses } from "@/lib/queries/discovery";
import { createPublicClient } from "@/lib/supabase/public";
import type { Json } from "@/types/database";

export type Opening = {
  slug: string;
  businessName: string;
  city: string | null;
  coverUrl: string | null;
  category: string;
  timezone: string;
  serviceId: string;
  /** Localized jsonb, resolved in the visitor's language by the client. */
  serviceName: Json;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  startsAt: string;
  staffProfileId: string | null;
};

const WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * The next free time at each well-rated salon - the "last minute" rail.
 *
 * One service per salon: the shortest bookable one, because it fits into the
 * most gaps and so gives the honest answer to "how soon can I get in there?".
 * The card names that service, so nobody reads "15:30" as a promise for a
 * three-hour colour. Slots come from `get_available_slots`, the same function
 * the booking flow uses, so a time shown here is a time that can be booked -
 * and booking still re-checks it under the exclusion constraint.
 */
export async function listOpenings(limit = 8): Promise<Opening[]> {
  const businesses = await searchBusinesses({ limit: 12 });
  if (businesses.length === 0) return [];

  const supabase = createPublicClient();
  const ids = businesses.map((business) => business.id);
  const [{ data: services }, { data: zones }] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, business_id, name, duration_minutes, price_cents, currency, service_staff ( staff_profile_id )",
      )
      .in("business_id", ids)
      .eq("is_active", true),
    supabase.from("businesses").select("id, timezone").in("id", ids),
  ]);

  const timezoneOf = new Map((zones ?? []).map((row) => [row.id, row.timezone]));
  const from = new Date();
  const to = new Date(from.getTime() + WINDOW_MS);

  const results = await Promise.all(
    businesses.map(async (business) => {
      const candidate = (services ?? [])
        .filter(
          (service) =>
            service.business_id === business.id && (service.service_staff ?? []).length > 0,
        )
        .sort(
          (a, b) => a.duration_minutes - b.duration_minutes || a.price_cents - b.price_cents,
        )[0];
      if (!candidate) return null;

      const { data: slots, error } = await supabase.rpc("get_available_slots", {
        p_service_id: candidate.id,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error || !slots?.length) return null;

      const first = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      const opening: Opening = {
        slug: business.slug,
        businessName: business.name,
        city: business.city,
        coverUrl:
          business.cover_image_url ?? fallbackBusinessImage(business.category, business.slug),
        category: business.category,
        timezone: timezoneOf.get(business.id) ?? "Europe/Sofia",
        serviceId: candidate.id,
        serviceName: candidate.name,
        durationMinutes: candidate.duration_minutes,
        priceCents: candidate.price_cents,
        currency: candidate.currency,
        startsAt: first.starts_at,
        staffProfileId: first.staff_profile_id,
      };
      return opening;
    }),
  );

  return results
    .filter((opening): opening is Opening => opening !== null)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}
