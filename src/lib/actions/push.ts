"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type PushResult = { ok: true } | { ok: false; code: string };

const subscribeSchema = z.object({
  endpoint: z.url().startsWith("https://"),
  p256dh: z.string().min(1).max(255),
  auth: z.string().min(1).max(255),
  userAgent: z.string().max(400).optional(),
});

/**
 * Stores a browser's push subscription against the signed-in account.
 *
 * RLS pins the row to the caller, and `endpoint` is unique, so re-subscribing
 * the same browser updates rather than adding a second row that would make
 * every notification arrive twice.
 */
export async function savePushSubscription(
  input: z.input<typeof subscribeSchema>,
): Promise<PushResult> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { ok: false, code: "unauthenticated" };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { ok: false, code: "generic" };
  return { ok: true };
}

/** Turning push off deletes the row; a kept-but-disabled endpoint is a trap. */
export async function removePushSubscription(
  endpoint: string,
): Promise<PushResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") {
    return { ok: false, code: "unauthenticated" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) return { ok: false, code: "generic" };
  return { ok: true };
}
