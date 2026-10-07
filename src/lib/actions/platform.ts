"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/platform/overview";
import { revalidatePublicSurfaces } from "@/lib/revalidate-public";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PlatformResult = { ok: true } | { ok: false; code: "forbidden" | "invalid" | "failed" | "self" | "admin" };

const ban = "876000h"; // a century; "none" lifts it

async function gate() {
  return (await isPlatformAdmin()) ? await createClient() : null;
}

function done(): PlatformResult {
  revalidatePath("/[locale]/platform", "page");
  return { ok: true };
}

const statusSchema = z.object({
  businessId: z.uuid(),
  status: z.enum(["active", "suspended", "draft"]),
  reason: z.string().trim().max(300).optional(),
});

/** Suspend a salon (it leaves search and its page, bookings stop) or bring it back. */
export async function setSalonStatus(input: z.input<typeof statusSchema>): Promise<PlatformResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const supabase = await gate();
  if (!supabase) return { ok: false, code: "forbidden" };

  const { error } = await supabase.rpc("platform_set_business_status", {
    p_business_id: parsed.data.businessId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, code: "failed" };

  await revalidatePublicSurfaces(parsed.data.businessId);
  return done();
}

const mediaSchema = z.object({
  businessId: z.uuid(),
  kind: z.enum(["logo", "cover", "gallery"]),
  url: z.string().max(1024).optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function removeSalonPhoto(input: z.input<typeof mediaSchema>): Promise<PlatformResult> {
  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const supabase = await gate();
  if (!supabase) return { ok: false, code: "forbidden" };

  const { error } = await supabase.rpc("platform_remove_business_media", {
    p_business_id: parsed.data.businessId,
    p_kind: parsed.data.kind,
    p_url: parsed.data.url,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, code: "failed" };

  await revalidatePublicSurfaces(parsed.data.businessId);
  return done();
}

const reviewSchema = z.object({
  reviewId: z.uuid(),
  businessId: z.uuid(),
  status: z.enum(["published", "hidden"]),
  reason: z.string().trim().max(300).optional(),
});

export async function setReviewVisibility(input: z.input<typeof reviewSchema>): Promise<PlatformResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const supabase = await gate();
  if (!supabase) return { ok: false, code: "forbidden" };

  const { error } = await supabase.rpc("platform_set_review_status", {
    p_review_id: parsed.data.reviewId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, code: "failed" };

  await revalidatePublicSurfaces(parsed.data.businessId);
  return done();
}

const userSchema = z.object({
  userId: z.uuid(),
  blocked: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Block or unblock a sign-in. A blocked account cannot sign in or refresh a
 * session; nothing it owns is deleted, so the block is fully reversible. The
 * platform admin's own account, and any other platform admin, cannot be blocked
 * from here.
 */
export async function setAccountBlocked(input: z.input<typeof userSchema>): Promise<PlatformResult> {
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const supabase = await gate();
  if (!supabase) return { ok: false, code: "forbidden" };

  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub === parsed.data.userId) return { ok: false, code: "self" };

  const { data: target } = await supabase
    .from("platform_admins")
    .select("profile_id")
    .eq("profile_id", parsed.data.userId)
    .maybeSingle();
  if (target) return { ok: false, code: "admin" };

  const { error } = await createAdminClient().auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: parsed.data.blocked ? ban : "none",
  });
  if (error) return { ok: false, code: "failed" };

  await supabase.rpc("platform_log", {
    p_action: parsed.data.blocked ? "block_account" : "unblock_account",
    p_target_type: "user",
    p_target_id: parsed.data.userId,
    p_details: { reason: parsed.data.reason ?? null },
  });
  return done();
}

export async function retryMessage(id: string): Promise<PlatformResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, code: "invalid" };
  const supabase = await gate();
  if (!supabase) return { ok: false, code: "forbidden" };
  const { error } = await supabase.rpc("platform_retry_notification", { p_id: id });
  if (error) return { ok: false, code: "failed" };
  return done();
}

export async function clearErrorGroup(fingerprint: string): Promise<PlatformResult> {
  if (!/^[0-9a-f]{16}$/.test(fingerprint)) return { ok: false, code: "invalid" };
  const supabase = await gate();
  if (!supabase) return { ok: false, code: "forbidden" };
  const { error } = await supabase.rpc("platform_clear_errors", { p_fingerprint: fingerprint });
  if (error) return { ok: false, code: "failed" };
  return done();
}

export async function setTicketStatus(id: string, status: "open" | "done"): Promise<PlatformResult> {
  if (!z.uuid().safeParse(id).success || !["open", "done"].includes(status)) {
    return { ok: false, code: "invalid" };
  }
  const supabase = await gate();
  if (!supabase) return { ok: false, code: "forbidden" };
  const { error } = await supabase.rpc("platform_set_ticket_status", { p_id: id, p_status: status });
  if (error) return { ok: false, code: "failed" };
  return done();
}
