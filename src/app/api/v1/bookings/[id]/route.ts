import { z } from "zod";

import { authenticate, isResponse } from "@/lib/api/auth";
import { loadBooking } from "@/lib/api/booking-json";
import { fail, ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(request, "read");
  if (isResponse(ctx)) return ctx;

  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return fail(404, "not_found", "Not found.");

  const booking = await loadBooking(ctx.db, ctx.businessId, id.data);
  return booking ? ok(booking) : fail(404, "not_found", "Not found.");
}
