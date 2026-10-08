import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { FetchFailure, safeRequest, UnsafeUrlError } from "@/lib/net/safe-fetch";

import { signWebhook } from "./sign";

export type WebhookReport = { claimed: number; delivered: number; retried: number; failed: number };

/** Minutes to wait after the 1st, 2nd ... failed attempt. Six attempts in all. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;
/** An endpoint that fails this many deliveries in a row is switched off. */
const DISABLE_AFTER_FAILED_DELIVERIES = 10;

type Outcome = { ok: true; status: number } | { ok: false; status: number | null; error: string };

export async function sendOnce(url: string, secret: string, id: string, event: string, body: string): Promise<Outcome> {
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const response = await safeRequest(url, {
      method: "POST",
      timeoutMs: 8_000,
      maxBytes: 64_000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Lavena-Webhooks/1",
        "Lavena-Event": event,
        "Lavena-Delivery": id,
        "Lavena-Signature": signWebhook(secret, timestamp, body),
      },
      body,
    });
    if (response.status >= 200 && response.status < 300) return { ok: true, status: response.status };
    return { ok: false, status: response.status, error: `http_${response.status}` };
  } catch (cause) {
    if (cause instanceof UnsafeUrlError) return { ok: false, status: null, error: "unsafe_url" };
    if (cause instanceof FetchFailure) return { ok: false, status: null, error: cause.code };
    return { ok: false, status: null, error: "network" };
  }
}

/**
 * Sends what the outbox holds. The claim is atomic (`skip locked`), so several
 * instances can run at once without delivering a message twice.
 */
export async function runWebhookWorker(limit = 25): Promise<WebhookReport> {
  const supabase = createAdminClient();
  const report: WebhookReport = { claimed: 0, delivered: 0, retried: 0, failed: 0 };

  const { data: claimed, error } = await supabase.rpc("claim_webhook_deliveries", { p_limit: limit });
  if (error) throw new Error(`claim failed: ${error.message}`);
  if (!claimed || claimed.length === 0) return report;
  report.claimed = claimed.length;

  const endpointIds = [...new Set(claimed.map((d) => d.endpoint_id))];
  const { data: endpoints } = await supabase
    .from("webhook_endpoints")
    .select("id, url, secret, is_active, consecutive_failures")
    .in("id", endpointIds);
  const byId = new Map((endpoints ?? []).map((e) => [e.id, e]));

  for (const delivery of claimed) {
    const endpoint = byId.get(delivery.endpoint_id);

    if (!endpoint || !endpoint.is_active) {
      await supabase
        .from("webhook_deliveries")
        .update({ status: "failed", last_error: "endpoint_inactive" })
        .eq("id", delivery.id);
      report.failed += 1;
      continue;
    }

    const body = JSON.stringify({ id: delivery.id, ...(delivery.payload as Record<string, unknown>) });
    const outcome = await sendOnce(endpoint.url, endpoint.secret, delivery.id, delivery.event, body);

    if (outcome.ok) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          last_status_code: outcome.status,
          last_error: null,
        })
        .eq("id", delivery.id);
      await supabase
        .from("webhook_endpoints")
        .update({ consecutive_failures: 0, last_success_at: new Date().toISOString() })
        .eq("id", endpoint.id);
      report.delivered += 1;
      continue;
    }

    // An address we refuse to call will not start working on a retry.
    const final = delivery.attempts >= MAX_ATTEMPTS || outcome.error === "unsafe_url";

    if (!final) {
      const waitMinutes = BACKOFF_MINUTES[Math.min(delivery.attempts - 1, BACKOFF_MINUTES.length - 1)];
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "queued",
          next_attempt_at: new Date(Date.now() + waitMinutes * 60_000).toISOString(),
          last_status_code: outcome.status,
          last_error: outcome.error,
        })
        .eq("id", delivery.id);
      report.retried += 1;
      continue;
    }

    await supabase
      .from("webhook_deliveries")
      .update({ status: "failed", last_status_code: outcome.status, last_error: outcome.error })
      .eq("id", delivery.id);

    const failures = endpoint.consecutive_failures + 1;
    const disable = failures >= DISABLE_AFTER_FAILED_DELIVERIES;
    await supabase
      .from("webhook_endpoints")
      .update({
        consecutive_failures: failures,
        last_failure_at: new Date().toISOString(),
        ...(disable ? { is_active: false, disabled_reason: "too_many_failures" } : {}),
      })
      .eq("id", endpoint.id);
    // Keep the local copy honest for the rest of this batch.
    endpoint.consecutive_failures = failures;
    if (disable) endpoint.is_active = false;
    report.failed += 1;
  }

  return report;
}
