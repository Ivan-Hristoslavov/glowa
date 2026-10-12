import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/** Strips what changes between two occurrences of the same bug: ids and numbers. */
function normalise(text: string) {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\d{3,}/g, ":n")
    .slice(0, 300);
}

export function fingerprintOf(message: string, path: string | null) {
  return createHash("sha1")
    .update(`${normalise(message)}|${normalise(path ?? "")}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Writes one error to the log the platform console reads. It never throws: the
 * thing that failed is already a problem, and the logger must not add another.
 * One bug that fires on every request is written at most 20 times an hour.
 */
export async function recordError(input: {
  source: "server" | "client";
  message: string;
  path?: string | null;
  method?: string | null;
  digest?: string | null;
  userId?: string | null;
  details?: Record<string, string | number | boolean | null>;
}) {
  try {
    const admin = createAdminClient();
    const fingerprint = fingerprintOf(input.message, input.path ?? null);

    const { data: allowed } = await admin.rpc("rate_limit_check", {
      p_key: `err:${fingerprint}`,
      p_limit: 20,
      p_window_seconds: 3600,
    });
    if (allowed === false) return;

    await admin.from("error_events").insert({
      source: input.source,
      fingerprint,
      message: input.message.slice(0, 1000),
      path: input.path?.slice(0, 300) ?? null,
      method: input.method ?? null,
      digest: input.digest ?? null,
      user_id: input.userId ?? null,
      details: input.details ?? {},
    });
  } catch (cause) {
    console.error("[errors] could not record", cause);
  }
}
