"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "mismatch" | "owner" | "generic" };

const schema = z.object({ confirmEmail: z.string().trim().min(3).max(320) });

/**
 * Deletes the caller's account (GDPR art. 17).
 *
 * The auth user is removed with the service role - the only way to delete
 * one - and the database does the rest: personal tables cascade, while
 * appointments and reviews keep existing without the link to this person
 * (`on delete set null`). Those appointments are the salon's records as an
 * independent controller; the reviews become anonymous.
 *
 * Refused while the person owns a salon: deleting them would leave a business
 * with nobody who can run it. They transfer it or write to us first.
 */
export async function deleteAccount(input: z.input<typeof schema>): Promise<DeleteAccountResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "mismatch" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email = data?.claims?.email;
  if (typeof userId !== "string") return { ok: false, code: "unauthorized" };

  // Typing the email is the confirmation; it has to be this account's.
  if (typeof email !== "string" || email.toLowerCase() !== parsed.data.confirmEmail.toLowerCase()) {
    return { ok: false, code: "mismatch" };
  }

  const { count } = await supabase
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId)
    .eq("role", "owner")
    .eq("status", "active");
  if ((count ?? 0) > 0) return { ok: false, code: "owner" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, code: "generic" };

  // The session belongs to a user that no longer exists; clear the cookies.
  await supabase.auth.signOut().catch(() => undefined);
  return { ok: true };
}
