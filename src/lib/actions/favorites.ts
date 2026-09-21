"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * RLS keys `saved_businesses` on `profile_id = auth.uid()`, so the caller can
 * only ever add or remove their own row; the user id is never taken from input.
 */
export async function toggleSavedBusiness(
  businessId: string,
  shouldSave: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (typeof userId !== "string") {
    return { ok: false, error: "unauthenticated" };
  }

  const { error } = shouldSave
    ? await supabase
        .from("saved_businesses")
        .upsert(
          { profile_id: userId, business_id: businessId },
          { onConflict: "profile_id,business_id" },
        )
    : await supabase
        .from("saved_businesses")
        .delete()
        .eq("profile_id", userId)
        .eq("business_id", businessId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/favorites", "page");
  return { ok: true };
}
