import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The address a request came from, as the platform's proxy reports it. On
 * Vercel `x-forwarded-for` is set by the edge and not by the visitor; locally
 * there is none and every request shares one bucket, which is fine for a
 * developer.
 */
export async function clientIp() {
  const list = await headers();
  return (list.get("x-forwarded-for")?.split(",")[0] ?? list.get("x-real-ip") ?? "local").trim();
}

/**
 * Counts one use of `name` by `subject` (the caller's address when omitted)
 * and says whether it is still within `limit` per `windowSeconds`.
 *
 * It fails open: if the counter cannot be reached the person is let through.
 * A limiter that locks everyone out when its table is slow is worse than the
 * abuse it prevents, and the failure is logged.
 */
export async function withinLimit(
  name: string,
  limit: number,
  windowSeconds: number,
  subject?: string,
): Promise<boolean> {
  try {
    const who = subject ?? (await clientIp());
    const { data, error } = await createAdminClient().rpc("rate_limit_check", {
      p_key: `${name}:${who.toLowerCase()}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] counter unavailable", error.message);
      return true;
    }
    return data !== false;
  } catch (cause) {
    console.error("[rate-limit] counter unavailable", cause);
    return true;
  }
}
