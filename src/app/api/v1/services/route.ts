import { authenticate, isResponse } from "@/lib/api/auth";
import { ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await authenticate(request, "read");
  if (isResponse(ctx)) return ctx;

  const includeInactive = new URL(request.url).searchParams.get("include_inactive") === "1";

  let query = ctx.db
    .from("services")
    .select(
      `id, external_id, name, description, category, duration_minutes,
       buffer_before_minutes, buffer_after_minutes, price_cents, currency,
       is_active, service_staff ( staff_profile_id )`,
    )
    .eq("business_id", ctx.businessId)
    .order("sort_order")
    .order("created_at");
  if (!includeInactive) query = query.eq("is_active", true);

  const { data } = await query;

  return ok({
    data: (data ?? []).map(({ service_staff, ...service }) => ({
      ...service,
      staff_ids: (service_staff ?? []).map((link) => link.staff_profile_id),
    })),
  });
}
