import { z } from "zod";

import { authenticate, flushWebhooksLater, isResponse } from "@/lib/api/auth";
import { readBody } from "@/lib/api/body";
import { BOOKING_SELECT, loadBooking, toBookingJson, type BookingRow } from "@/lib/api/booking-json";
import { fail, failFromDatabase, ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z
  .object({
    service_id: z.uuid(),
    starts_at: z.iso.datetime({ offset: true }),
    staff_id: z.uuid().optional(),
    location_id: z.uuid().optional(),
    customer: z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.email().max(200).optional(),
        phone: z.string().trim().min(3).max(32).optional(),
      })
      .strict()
      .refine((c) => Boolean(c.email || c.phone), { message: "email or phone is required" }),
    notes: z.string().trim().max(1000).optional(),
    // The caller's own id for this booking: send the same one again and you
    // get the same booking back instead of a second one.
    external_ref: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

/**
 * Book a visit. The time must be one the availability endpoint offers; the
 * database re-checks it and the exclusion constraint settles any race, so two
 * simultaneous calls for one stylist cannot both succeed. API bookings are
 * confirmed immediately and never take a deposit.
 */
export async function POST(request: Request) {
  const ctx = await authenticate(request, "bookings");
  if (isResponse(ctx)) return ctx;

  const body = await readBody(request, createSchema);
  if (body instanceof Response) return body;

  let replay = false;
  if (body.external_ref) {
    const { data: existing } = await ctx.db
      .from("appointments")
      .select("id")
      .eq("business_id", ctx.businessId)
      .eq("external_ref", body.external_ref)
      .maybeSingle();
    replay = Boolean(existing);
  }

  const { data, error } = await ctx.db.rpc("api_book_appointment", {
    p_business_id: ctx.businessId,
    p_service_id: body.service_id,
    p_starts_at: body.starts_at,
    p_customer_name: body.customer.name,
    p_staff_profile_id: body.staff_id,
    p_customer_email: body.customer.email,
    p_customer_phone: body.customer.phone,
    p_notes: body.notes,
    p_external_ref: body.external_ref,
    p_location_id: body.location_id,
  });
  if (error || !data) return failFromDatabase(error);

  if (!replay) flushWebhooksLater();

  const booking = await loadBooking(ctx.db, ctx.businessId, data.id);
  return ok(booking, replay ? 200 : 201);
}

const listQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]).optional(),
  updated_since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

function asIso(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Bookings of the salon, newest start first. Filter by time, status or change. */
export async function GET(request: Request) {
  const ctx = await authenticate(request, "read");
  if (isResponse(ctx)) return ctx;

  const parsed = listQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(422, "invalid_request", "Bad query parameters.");
  const q = parsed.data;

  const from = asIso(q.from);
  const to = asIso(q.to);
  const updatedSince = asIso(q.updated_since);
  if (from === null || to === null || updatedSince === null) {
    return fail(422, "invalid_request", "Dates must be ISO 8601.");
  }

  let query = ctx.db
    .from("appointments")
    .select(BOOKING_SELECT)
    .eq("business_id", ctx.businessId)
    .eq("is_demo", false)
    .order("starts_at", { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);
  if (from) query = query.gte("starts_at", from);
  if (to) query = query.lt("starts_at", to);
  if (q.status) query = query.eq("status", q.status);
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  const { data, error } = await query;
  if (error) return failFromDatabase(error);

  return ok({
    data: (data ?? []).map((row) => toBookingJson(row as unknown as BookingRow)),
    limit: q.limit,
    offset: q.offset,
  });
}
