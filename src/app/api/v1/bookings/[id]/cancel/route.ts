import { z } from "zod";

import { authenticate, flushWebhooksLater, isResponse } from "@/lib/api/auth";
import { loadBooking } from "@/lib/api/booking-json";
import { fail, failFromDatabase, ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ reason: z.string().trim().max(500).optional() }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request, "bookings");
  if (isResponse(ctx)) return ctx;

  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");

  const text = await request.text();
  let reason: string | undefined;
  if (text.trim()) {
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (!parsed.success) return fail(422, "invalid_request", "Only an optional reason is accepted.");
      reason = parsed.data.reason;
    } catch {
      return fail(400, "invalid_json", "The body must be valid JSON.");
    }
  }

  const { error } = await ctx.db.rpc("api_cancel_appointment", {
    p_business_id: ctx.businessId,
    p_appointment_id: id.data,
    p_reason: reason,
  });
  if (error) return failFromDatabase(error);

  flushWebhooksLater();
  const booking = await loadBooking(ctx.db, ctx.businessId, id.data);
  return ok(booking);
}
