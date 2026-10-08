import { authenticate, isResponse } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await authenticate(request, "read");
  if (isResponse(ctx)) return ctx;

  const [{ data: business }, { data: locations }] = await Promise.all([
    ctx.db
      .from("businesses")
      .select("id, slug, name, timezone, default_locale")
      .eq("id", ctx.businessId)
      .maybeSingle(),
    ctx.db
      .from("locations")
      .select("id, name, address_line1, city, phone, is_primary, is_active")
      .eq("business_id", ctx.businessId)
      .order("is_primary", { ascending: false }),
  ]);

  if (!business) return fail(404, "not_found", "Not found.");

  return ok({
    id: business.id,
    slug: business.slug,
    name: business.name,
    timezone: business.timezone,
    default_locale: business.default_locale,
    page_url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/${business.default_locale}/business/${business.slug}`,
    book_url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/${business.default_locale}/business/${business.slug}/book`,
    locations: (locations ?? []).filter((l) => l.is_active).map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address_line1,
      city: l.city,
      phone: l.phone,
      is_primary: l.is_primary,
    })),
  });
}
