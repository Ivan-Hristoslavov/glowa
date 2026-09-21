/**
 * The RPCs signal a specific failure through the Postgres `hint` field.
 * Narrowing to this union keeps the message lookup typed and guarantees an
 * unexpected code degrades to a friendly sentence instead of leaking SQL.
 */
const KNOWN_CODES = [
  "not_cancellable",
  "not_reschedulable",
  "window_closed",
  "reschedule_disabled",
  "slot_unavailable",
  "slot_taken",
] as const;

export type BookingErrorCode = (typeof KNOWN_CODES)[number] | "generic";

export function bookingErrorCode(code: string): BookingErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code)
    ? (code as BookingErrorCode)
    : "generic";
}
