"use server";

import { requireMembership } from "@/lib/actions/guard";

export type AudiencePreview =
  | { ok: true; count: number }
  | { ok: false; code: string };

/**
 * Returns only how many clients a segment reaches. The names behind it stay on
 * the server: a count is all the editor needs to make the decision.
 */
export async function previewAudienceAction(
  businessId: string,
  audience: Record<string, unknown>,
): Promise<AudiencePreview> {
  const guard = await requireMembership(businessId, "manager");
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase.rpc("preview_campaign_audience", {
    p_business_id: businessId,
    p_audience: audience as never,
    p_limit: 500,
  });

  if (error) return { ok: false, code: "generic" };
  return { ok: true, count: (data ?? []).length };
}
