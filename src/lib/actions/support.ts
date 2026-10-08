"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";

import { withinLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { passesCaptcha } from "@/lib/turnstile";

export type SupportState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; code: "invalid" | "rateLimited" | "failed" };

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.email().max(200),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(5).max(4000),
  page: z.string().max(300).optional(),
});

/**
 * Anyone can write to support, signed in or not, so it is rate limited and, when
 * configured, behind the captcha. A signed-in sender is linked to their account
 * and to the salon they are working in, which saves the first question.
 */
export async function submitSupportRequest(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const parsed = schema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    page: formData.get("page") || undefined,
  });
  if (!parsed.success) return { status: "error", code: "invalid" };

  if (!(await withinLimit("support", 5, 3600)) || !(await passesCaptcha(formData))) {
    return { status: "error", code: "rateLimited" };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  let businessId: string | null = null;
  if (userId) {
    const { data: membership } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("profile_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    businessId = membership?.business_id ?? null;
  }

  const { error } = await createAdminClient()
    .from("support_tickets")
    .insert({
      profile_id: userId,
      business_id: businessId,
      name: parsed.data.name ?? null,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      page: parsed.data.page ?? null,
      locale: await getLocale(),
    });
  if (error) return { status: "error", code: "failed" };

  return { status: "sent" };
}
