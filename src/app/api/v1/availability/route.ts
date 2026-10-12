import { z } from "zod";

import { authenticate, isResponse } from "@/lib/api/auth";
import { fail, failFromDatabase, ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const query = z.object({
  service_id: z.uuid(),
  from: day,
  to: day.optional(),
  staff_id: z.uuid().optional(),
  location_id: z.uuid().optional(),
});

function plusDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Free start times, computed by the same database function the Lavena booking
 * page uses (working hours, time off, closures, buffers, lead time, existing
 * bookings). At most 31 days per call.
 */
export async function GET(request: Request) {
  const ctx = await authenticate(request, "read");
  if (isResponse(ctx)) return ctx;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) return fail(422, "invalid_request", "service_id and from (YYYY-MM-DD) are required.");

  const { service_id, from, staff_id, location_id } = parsed.data;
  const to = parsed.data.to ?? plusDays(from, 6);
  if (to < from) return fail(422, "invalid_request", "to must not be before from.");
  if (to > plusDays(from, 30)) return fail(422, "range_too_large", "Ask for at most 31 days at a time.");

  const { data: service } = await ctx.db
    .from("services")
    .select("id")
    .eq("id", service_id)
    .eq("business_id", ctx.businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (!service) return fail(404, "not_found", "Service not found.");

  const { data, error } = await ctx.db.rpc("get_available_slots", {
    p_service_id: service_id,
    p_from: from,
    p_to: to,
    p_staff_profile_id: staff_id,
    p_location_id: location_id,
  });
  if (error) return failFromDatabase(error);

  return ok({
    data: (data ?? []).map((slot) => ({
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      staff_id: slot.staff_profile_id,
    })),
  });
}
