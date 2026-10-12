import { authenticate, isResponse } from "@/lib/api/auth";
import { ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const ctx = await authenticate(request, "read");
  if (isResponse(ctx)) return ctx;

  const { data } = await ctx.db
    .from("staff_profiles")
    .select("id, display_name, is_bookable, sort_order")
    .eq("business_id", ctx.businessId)
    .order("sort_order")
    .order("display_name");

  return ok({
    data: (data ?? []).map((s) => ({ id: s.id, name: s.display_name, bookable: s.is_bookable })),
  });
}
