"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";
import { API_KEY_SCOPES, generateApiKey, generateWebhookSecret } from "@/lib/api/keys";
import { syncCalendarFeed } from "@/lib/calendar-feeds/sync";
import { assertSafeUrl, UnsafeUrlError } from "@/lib/net/safe-fetch";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWebhookWorker, sendOnce } from "@/lib/webhooks/worker";

/**
 * Everything on the integrations screen. Owners and admins only: a key can
 * book and read the whole client list of the salon, so the same people who
 * can change billing are the ones who can hand one out.
 *
 * Row-level security is the real gate (every policy asks `is_business_admin`);
 * `requireMembership(..., "admin")` makes the failure legible. The service
 * client is used only for the few writes the browser role has no grant for
 * (a failure counter, a delivery record), and only after that check.
 */

export type IntegrationResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: string };

const EVENTS = ["booking.created", "booking.rescheduled", "booking.cancelled", "booking.status_changed"] as const;

const MAX_ACTIVE_KEYS = 10;
const MAX_ENDPOINTS = 5;
const MAX_FEEDS = 10;

function refresh() {
  revalidatePath("/[locale]/dashboard/integrations", "page");
}

// --- API keys -----------------------------------------------------------------

const keySchema = z.object({
  businessId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
});

export async function createApiKeyAction(
  input: z.input<typeof keySchema>,
): Promise<IntegrationResult<{ key: string }>> {
  const parsed = keySchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { count } = await guard.supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("business_id", parsed.data.businessId)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) return { ok: false, code: "limit" };

  const { key, prefix, hash } = generateApiKey();
  const { error } = await guard.supabase.from("api_keys").insert({
    business_id: parsed.data.businessId,
    name: parsed.data.name,
    key_prefix: prefix,
    key_hash: hash,
    scopes: [...new Set(parsed.data.scopes)],
    created_by: guard.userId,
  });
  if (error) return { ok: false, code: "generic" };

  refresh();
  // The only time the plain key exists outside the person's own clipboard.
  return { ok: true, key };
}

const idSchema = z.object({ businessId: z.uuid(), id: z.uuid() });

export async function revokeApiKeyAction(input: z.input<typeof idSchema>): Promise<IntegrationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId)
    .is("revoked_at", null);
  if (error) return { ok: false, code: "generic" };

  refresh();
  return { ok: true };
}

// --- webhooks -----------------------------------------------------------------

/** The URL as a string if it passes the static checks, else null. */
function checkWebhookUrl(raw: string) {
  try {
    return assertSafeUrl(raw).toString();
  } catch (cause) {
    if (cause instanceof UnsafeUrlError) return null;
    throw cause;
  }
}

const webhookSchema = z.object({
  businessId: z.uuid(),
  url: z.string().trim().max(500),
  description: z.string().trim().max(120).optional(),
  events: z.array(z.enum(EVENTS)).max(EVENTS.length),
});

export async function createWebhookAction(
  input: z.input<typeof webhookSchema>,
): Promise<IntegrationResult<{ secret: string }>> {
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const url = checkWebhookUrl(parsed.data.url);
  if (!url) return { ok: false, code: "unsafe_url" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { count } = await guard.supabase
    .from("webhook_endpoints")
    .select("id", { count: "exact", head: true })
    .eq("business_id", parsed.data.businessId);
  if ((count ?? 0) >= MAX_ENDPOINTS) return { ok: false, code: "limit" };

  const secret = generateWebhookSecret();
  const { error } = await guard.supabase.from("webhook_endpoints").insert({
    business_id: parsed.data.businessId,
    url,
    description: parsed.data.description || null,
    events: [...new Set(parsed.data.events)],
    secret,
    created_by: guard.userId,
  });
  if (error) return { ok: false, code: "generic" };

  refresh();
  return { ok: true, secret };
}

const toggleSchema = z.object({ businessId: z.uuid(), id: z.uuid(), active: z.boolean() });

export async function setWebhookActiveAction(input: z.input<typeof toggleSchema>): Promise<IntegrationResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  // Switching it back on is a fresh start: the failure count and the reason
  // for the earlier switch-off are cleared (the browser role cannot write those).
  const { data: own } = await guard.supabase
    .from("webhook_endpoints")
    .select("id")
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();
  if (!own) return { ok: false, code: "not_found" };

  const { error } = await createAdminClient()
    .from("webhook_endpoints")
    .update(
      parsed.data.active
        ? { is_active: true, consecutive_failures: 0, disabled_reason: null }
        : { is_active: false },
    )
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId);
  if (error) return { ok: false, code: "generic" };

  refresh();
  return { ok: true };
}

export async function deleteWebhookAction(input: z.input<typeof idSchema>): Promise<IntegrationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId);
  if (error) return { ok: false, code: "generic" };

  refresh();
  return { ok: true };
}

/** Sends a sample event now, so the owner can see their server answer. */
export async function testWebhookAction(
  input: z.input<typeof idSchema>,
): Promise<IntegrationResult<{ status: number | null; error: string | null }>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { data: own } = await guard.supabase
    .from("webhook_endpoints")
    .select("id")
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();
  if (!own) return { ok: false, code: "not_found" };

  const db = createAdminClient();
  const { data: endpoint } = await db
    .from("webhook_endpoints")
    .select("id, url, secret")
    .eq("id", own.id)
    .maybeSingle();
  if (!endpoint) return { ok: false, code: "not_found" };

  const now = new Date();
  const deliveryId = crypto.randomUUID();
  const payload = {
    type: "webhook.test",
    created_at: now.toISOString(),
    data: { message: "This is a test event from Lavena." },
  };
  const outcome = await sendOnce(
    endpoint.url,
    endpoint.secret,
    deliveryId,
    "webhook.test",
    JSON.stringify({ id: deliveryId, ...payload }),
  );

  await db.from("webhook_deliveries").insert({
    id: deliveryId,
    endpoint_id: endpoint.id,
    business_id: parsed.data.businessId,
    event: "webhook.test",
    payload,
    status: outcome.ok ? "delivered" : "failed",
    attempts: 1,
    last_attempt_at: now.toISOString(),
    delivered_at: outcome.ok ? now.toISOString() : null,
    last_status_code: outcome.status,
    last_error: outcome.ok ? null : outcome.error,
  });

  refresh();
  return { ok: true, status: outcome.status, error: outcome.ok ? null : outcome.error };
}

/** Pushes anything that is waiting, without waiting for the scheduler. */
export async function flushWebhooksAction(input: { businessId: string }): Promise<IntegrationResult> {
  const parsed = z.object({ businessId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  await runWebhookWorker(25).catch(() => undefined);
  refresh();
  return { ok: true };
}

// --- calendar feeds -----------------------------------------------------------

const feedSchema = z.object({
  businessId: z.uuid(),
  staffProfileId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().max(1000),
});

export async function createCalendarFeedAction(
  input: z.input<typeof feedSchema>,
): Promise<IntegrationResult<{ synced: boolean; error: string | null; count: number }>> {
  const parsed = feedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  // Calendar apps hand out webcal:// links; it is https underneath.
  const url = checkWebhookUrl(parsed.data.url.replace(/^webcal:\/\//i, "https://"));
  if (!url) return { ok: false, code: "unsafe_url" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { count } = await guard.supabase
    .from("calendar_feeds")
    .select("id", { count: "exact", head: true })
    .eq("business_id", parsed.data.businessId);
  if ((count ?? 0) >= MAX_FEEDS) return { ok: false, code: "limit" };

  const { data: created, error } = await guard.supabase
    .from("calendar_feeds")
    .insert({
      business_id: parsed.data.businessId,
      staff_profile_id: parsed.data.staffProfileId,
      name: parsed.data.name,
      url,
      created_by: guard.userId,
    })
    .select("id, url, business_id")
    .single();
  if (error || !created) {
    return { ok: false, code: error?.code === "23505" ? "duplicate" : error?.code === "23514" ? "invalid" : "generic" };
  }

  const result = await syncCalendarFeed(created);
  refresh();
  return result.ok
    ? { ok: true, synced: true, error: null, count: result.count }
    : { ok: true, synced: false, error: result.error, count: 0 };
}

export async function syncCalendarFeedAction(
  input: z.input<typeof idSchema>,
): Promise<IntegrationResult<{ error: string | null; count: number }>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { data: feed } = await guard.supabase
    .from("calendar_feeds")
    .select("id, url, business_id")
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();
  if (!feed) return { ok: false, code: "not_found" };

  const result = await syncCalendarFeed(feed);
  refresh();
  revalidatePath("/[locale]/dashboard/time-off", "page");
  return result.ok
    ? { ok: true, error: null, count: result.count }
    : { ok: true, error: result.error, count: 0 };
}

export async function deleteCalendarFeedAction(input: z.input<typeof idSchema>): Promise<IntegrationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  // The copied busy time goes with the feed (on delete cascade).
  const { error } = await guard.supabase
    .from("calendar_feeds")
    .delete()
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId);
  if (error) return { ok: false, code: "generic" };

  refresh();
  revalidatePath("/[locale]/dashboard/time-off", "page");
  return { ok: true };
}
