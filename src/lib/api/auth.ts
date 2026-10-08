import "server-only";

import { after } from "next/server";

import { bearerKey, hashApiKey, type ApiScope } from "@/lib/api/keys";
import { fail } from "@/lib/api/http";
import { withinLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export type ApiContext = {
  businessId: string;
  keyId: string;
  scopes: string[];
  db: ReturnType<typeof createAdminClient>;
};

/** Requests per key per minute. Generous for a website, small for a script gone wrong. */
const PER_KEY_PER_MINUTE = 120;
/** Wrong or missing keys per address per minute, before the answer turns into 429. */
const BAD_KEYS_PER_MINUTE = 20;

/**
 * Who is calling, and may they do this?
 *
 * The key is the whole identity: it names one salon, and every query that
 * follows is scoped to that salon in code, because the service-role client
 * used here bypasses row-level security. Nothing from the request body or URL
 * is ever trusted as a business id.
 */
export async function authenticate(
  request: Request,
  scope: ApiScope,
): Promise<ApiContext | Response> {
  const key = bearerKey(request);
  const db = createAdminClient();

  const identity = key
    ? await db.rpc("verify_api_key", { p_key_hash: hashApiKey(key) })
    : null;
  const row = identity?.data?.[0];

  if (!row) {
    const allowed = await withinLimit("api-bad-key", BAD_KEYS_PER_MINUTE, 60);
    if (!allowed) return fail(429, "rate_limited", "Too many requests.");
    return fail(401, "invalid_key", "Missing or invalid API key.");
  }

  if (!(await withinLimit("api-key", PER_KEY_PER_MINUTE, 60, row.api_key_id))) {
    return fail(429, "rate_limited", "Too many requests.");
  }

  if (!row.scopes.includes(scope)) {
    return fail(403, "missing_scope", `This key does not have the "${scope}" scope.`);
  }

  return { businessId: row.business_id, keyId: row.api_key_id, scopes: row.scopes, db };
}

export function isResponse(value: ApiContext | Response): value is Response {
  return value instanceof Response;
}

/** After the answer is sent, deliver the webhooks it queued. */
export function flushWebhooksLater() {
  after(async () => {
    const { runWebhookWorker } = await import("@/lib/webhooks/worker");
    await runWebhookWorker(25).catch(() => undefined);
  });
}
