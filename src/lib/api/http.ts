import "server-only";

/** Every API answer: JSON, never cached, errors in one shape. */
const HEADERS = { "Cache-Control": "no-store" } as const;

export function ok(body: unknown, status = 200) {
  return Response.json(body, { status, headers: HEADERS });
}

export function fail(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error: { code, message, ...extra } }, { status, headers: HEADERS });
}

/** The Postgres error `hint` the booking functions raise, as an API answer. */
export function failFromDatabase(error: { message: string; hint?: string | null; code?: string } | null) {
  const hint = error?.hint ?? "";
  if (hint === "slot_unavailable" || hint === "slot_taken") {
    return fail(409, hint, "That time is not available.");
  }
  if (hint === "not_cancellable") {
    return fail(409, hint, "Only a pending or confirmed booking can be cancelled.");
  }
  if (hint === "customer_required") {
    return fail(422, hint, "A name and an email or phone are required.");
  }
  if (error?.code === "P0002") return fail(404, "not_found", "Not found.");
  if (error?.code === "23514") return fail(422, "invalid", "The request cannot be booked.");
  console.error("[api] unexpected database error", error?.message);
  return fail(500, "server_error", "Something went wrong.");
}
