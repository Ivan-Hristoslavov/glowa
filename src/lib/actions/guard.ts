import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; code: string };

/**
 * RLS is what actually enforces access; this exists so an action can fail with
 * a clear code instead of silently updating zero rows, and so we never write
 * against a business the caller merely guessed the id of.
 */
export async function requireMembership(
  businessId: string,
  level: "member" | "manager" | "admin" = "manager",
) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;

  if (typeof userId !== "string") {
    return { ok: false as const, code: "unauthenticated" };
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("role, status")
    .eq("business_id", businessId)
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return { ok: false as const, code: "not_a_member" };

  const allowed =
    level === "member"
      ? true
      : level === "manager"
        ? ["owner", "admin", "manager"].includes(membership.role)
        : ["owner", "admin"].includes(membership.role);

  if (!allowed) return { ok: false as const, code: "forbidden" };

  return { ok: true as const, supabase, userId, role: membership.role };
}

/**
 * Turn the Postgres error codes we expect into something the UI can phrase:
 * 23P01 is the exclusion constraint (two appointments for one specialist),
 * 23514 a check constraint (a row the schema refuses, e.g. no customer at all).
 */
export function mapWriteError(error: { code?: string | null } | null) {
  if (error?.code === "23P01") return "overlap";
  if (error?.code === "23514") return "invalid";
  return "generic";
}
