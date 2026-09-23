"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";

export type GrowthResult =
  | { ok: true; id?: string }
  | { ok: false; code: string };

const createSchema = z.object({
  businessId: z.uuid(),
  kind: z.enum(["qr", "referral", "campaign"]),
  label: z.string().trim().min(1).max(80),
  target: z.enum(["business", "book"]),
  serviceId: z.uuid().nullable(),
  // A referral belongs to a client the salon already has on file. Free-text
  // names are refused on purpose: the credit has to point at a real record.
  referrerClientId: z.uuid().nullable(),
});

export async function createGrowthLink(
  input: z.input<typeof createSchema>,
): Promise<GrowthResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const value = parsed.data;

  const guard = await requireMembership(value.businessId, "manager");
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase
    .from("growth_links")
    // `code`, `visit_count` and `booking_count` are set by triggers; anything
    // sent for them is overwritten.
    .insert({
      business_id: value.businessId,
      kind: value.kind,
      label: value.label,
      target: value.target,
      service_id: value.target === "book" ? value.serviceId : null,
      referrer_client_id:
        value.kind === "referral" ? value.referrerClientId : null,
      created_by: guard.userId,
      code: "placeholder",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/growth", "page");
  return { ok: true, id: data.id };
}

const toggleSchema = z.object({
  businessId: z.uuid(),
  linkId: z.uuid(),
  isActive: z.boolean(),
});

export async function setGrowthLinkActive(
  input: z.input<typeof toggleSchema>,
): Promise<GrowthResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const value = parsed.data;

  const guard = await requireMembership(value.businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("growth_links")
    .update({ is_active: value.isActive })
    .eq("id", value.linkId)
    .eq("business_id", value.businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/growth", "page");
  return { ok: true };
}

/**
 * Deletes rather than deactivates. A printed code that is gone should resolve
 * to nothing; keeping the row would keep counting scans of a poster nobody
 * maintains. The appointments it brought in keep their history - the foreign
 * key is `on delete set null`.
 */
export async function deleteGrowthLink(
  businessId: string,
  linkId: string,
): Promise<GrowthResult> {
  const guard = await requireMembership(businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("growth_links")
    .delete()
    .eq("id", linkId)
    .eq("business_id", businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/growth", "page");
  return { ok: true };
}
