"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";

export type CrmResult = { ok: true } | { ok: false; code: string };

const clientSchema = z.object({
  businessId: z.uuid(),
  clientId: z.uuid(),
  fullName: z.string().trim().max(120).optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(20),
  consentMarketing: z.boolean(),
});

export async function updateBusinessClient(
  input: z.input<typeof clientSchema>,
): Promise<CrmResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { data: existing } = await guard.supabase
    .from("business_clients")
    .select("consent_marketing")
    .eq("id", parsed.data.clientId)
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();

  if (!existing) return { ok: false, code: "invalid" };

  const consentChanged = existing.consent_marketing !== parsed.data.consentMarketing;

  const { error } = await guard.supabase
    .from("business_clients")
    .update({
      full_name: parsed.data.fullName || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
      tags: parsed.data.tags,
      consent_marketing: parsed.data.consentMarketing,
      // Consent needs a date to be auditable, so stamp it only when it moves.
      ...(consentChanged ? { consent_updated_at: new Date().toISOString() } : {}),
    })
    .eq("id", parsed.data.clientId)
    .eq("business_id", parsed.data.businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/clients", "page");
  return { ok: true };
}

const responseSchema = z.object({
  businessId: z.uuid(),
  reviewId: z.uuid(),
  response: z.string().trim().max(2000),
});

export async function respondToReview(
  input: z.input<typeof responseSchema>,
): Promise<CrmResult> {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  // app.enforce_review_edit stops a business from touching the rating or text;
  // responded_at is stamped by that trigger.
  const { error } = await guard.supabase
    .from("reviews")
    .update({ business_response: parsed.data.response || null })
    .eq("id", parsed.data.reviewId)
    .eq("business_id", parsed.data.businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/reviews", "page");
  return { ok: true };
}

const reviewStatusSchema = z.object({
  businessId: z.uuid(),
  reviewId: z.uuid(),
  status: z.enum(["published", "hidden"]),
});

export async function setReviewStatus(
  input: z.input<typeof reviewStatusSchema>,
): Promise<CrmResult> {
  const parsed = reviewStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("reviews")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.reviewId)
    .eq("business_id", parsed.data.businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/reviews", "page");
  return { ok: true };
}

const campaignSchema = z.object({
  businessId: z.uuid(),
  campaignId: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["win_back", "reminder", "birthday", "anniversary", "custom"]),
  audience: z.object({
    last_visit_before_days: z.number().int().min(1).max(3650).optional(),
    min_visits: z.number().int().min(0).max(1000).optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
  }),
  subject: z.object({
    bg: z.string().trim().max(200).optional(),
    en: z.string().trim().max(200).optional(),
    ro: z.string().trim().max(200).optional(),
  }),
  body: z.object({
    bg: z.string().trim().max(4000).optional(),
    en: z.string().trim().max(4000).optional(),
    ro: z.string().trim().max(4000).optional(),
  }),
});

export async function upsertCampaign(
  input: z.input<typeof campaignSchema>,
): Promise<CrmResult> {
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const subject = Object.fromEntries(
    Object.entries(parsed.data.subject).filter(([, value]) => value?.trim()),
  );
  // The subject was already per-language while the body was one string, which
  // would mail a Bulgarian paragraph under a Romanian subject line.
  const body = Object.fromEntries(
    Object.entries(parsed.data.body).filter(([, value]) => value?.trim()),
  );

  const payload = {
    business_id: parsed.data.businessId,
    name: parsed.data.name,
    type: parsed.data.type,
    channel: "email" as const,
    // Editing always lands a draft; `queue_campaign` is the only thing that
    // moves a campaign out of it, and it refuses anything already sent.
    status: "draft" as const,
    audience: parsed.data.audience,
    template: {
      ...(Object.keys(subject).length ? { subject } : {}),
      ...(Object.keys(body).length ? { body } : {}),
    },
    created_by: guard.userId,
  };

  const { error } = parsed.data.campaignId
    ? await guard.supabase
        .from("marketing_campaigns")
        .update(payload)
        .eq("id", parsed.data.campaignId)
        .eq("business_id", parsed.data.businessId)
    : await guard.supabase.from("marketing_campaigns").insert(payload);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/marketing", "page");
  return { ok: true };
}

export type SendCampaignResult =
  | { ok: true; queued: number }
  | { ok: false; code: string };

/**
 * Queues a campaign. The RPC does the authorization, the audience selection
 * and the idempotency, because all three have to happen in one transaction
 * against rows a browser cannot see.
 *
 * Nothing is sent here: the rows land in the notification outbox and the same
 * worker that handles reminders drains them. One queue, one retry policy.
 */
export async function sendCampaign(
  businessId: string,
  campaignId: string,
): Promise<SendCampaignResult> {
  const guard = await requireMembership(businessId, "manager");
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase.rpc("queue_campaign", {
    p_campaign_id: campaignId,
  });

  if (error) {
    // The RPC puts a stable code in `hint`; anything else stays generic so a
    // Postgres string never reaches the screen.
    return { ok: false, code: error.hint ?? "generic" };
  }

  revalidatePath("/[locale]/dashboard/marketing", "page");
  return { ok: true, queued: data ?? 0 };
}
