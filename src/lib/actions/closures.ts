"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";

export type ClosureResult =
  | { ok: true; overlapping: number }
  | { ok: false; code: string };

const addSchema = z
  .object({
    businessId: z.uuid(),
    locationId: z.uuid().nullable(),
    // Instants, already converted from the salon's wall clock by the client
    // with the business timezone (lib/timezone.ts, DST-safe).
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    path: ["endsAt"],
  });

function revalidateSchedules() {
  revalidatePath("/[locale]/dashboard/time-off", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/business/[slug]", "page");
}

/**
 * Closes the salon (or one location) for a stretch of time. Returns how many
 * live appointments already sit inside it: a closure never cancels anyone by
 * itself - those are people who were told they had a time - but the owner
 * needs to know to call them.
 */
export async function addClosure(input: z.input<typeof addSchema>): Promise<ClosureResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { businessId, locationId, startsAt, endsAt, reason } = parsed.data;

  const { error } = await guard.supabase.from("business_closures").insert({
    business_id: businessId,
    location_id: locationId,
    starts_at: startsAt,
    ends_at: endsAt,
    reason: reason || null,
  });
  if (error) {
    return { ok: false, code: error.code === "23514" ? "invalid" : "generic" };
  }

  let overlapping = guard.supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);
  if (locationId) overlapping = overlapping.eq("location_id", locationId);
  const { count } = await overlapping;

  revalidateSchedules();
  return { ok: true, overlapping: count ?? 0 };
}

const removeSchema = z.object({ businessId: z.uuid(), closureId: z.uuid() });

export async function removeClosure(
  input: z.input<typeof removeSchema>,
): Promise<ClosureResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("business_closures")
    .delete()
    .eq("id", parsed.data.closureId)
    .eq("business_id", parsed.data.businessId);
  if (error) return { ok: false, code: "generic" };

  revalidateSchedules();
  return { ok: true, overlapping: 0 };
}
