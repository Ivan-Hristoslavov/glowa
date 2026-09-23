"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";
import { createClient } from "@/lib/supabase/server";

export type WaitlistResult = { ok: true } | { ok: false; code: string };

const joinSchema = z.object({
  businessId: z.uuid(),
  serviceId: z.uuid().nullable(),
  staffProfileId: z.uuid().nullable(),
  fromDate: z.iso.date(),
  toDate: z.iso.date(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Joining is a plain insert: RLS requires the row to be the caller's own, and
 * a BEFORE trigger forces status, offer counters and a sane start date, so
 * there is nothing here worth an RPC.
 */
export async function joinWaitlist(
  input: z.input<typeof joinSchema>,
): Promise<WaitlistResult> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const value = parsed.data;

  if (value.toDate < value.fromDate) return { ok: false, code: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { ok: false, code: "unauthenticated" };

  const { error } = await supabase.from("waitlist_entries").insert({
    business_id: value.businessId,
    profile_id: userId,
    service_id: value.serviceId,
    staff_profile_id: value.staffProfileId,
    from_date: value.fromDate,
    to_date: value.toDate,
    note: value.note || null,
  });

  if (error) {
    // The partial unique index is what enforces one live entry per person.
    return { ok: false, code: error.code === "23505" ? "already_waiting" : "generic" };
  }

  revalidatePath("/[locale]/bookings", "page");
  return { ok: true };
}

/** Leaving is the only status change a customer may make on their own entry. */
export async function leaveWaitlist(entryId: string): Promise<WaitlistResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") {
    return { ok: false, code: "unauthenticated" };
  }

  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/bookings", "page");
  return { ok: true };
}

/** The salon clearing its own list once someone has been served. */
export async function resolveWaitlistEntry(
  businessId: string,
  entryId: string,
  status: "booked" | "expired",
): Promise<WaitlistResult> {
  const guard = await requireMembership(businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("waitlist_entries")
    .update({ status })
    .eq("id", entryId)
    .eq("business_id", businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { ok: true };
}
