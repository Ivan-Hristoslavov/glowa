"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional(),
  locale: z.enum(routing.locales),
  timezone: z.string().trim().min(1).max(64),
  avatarUrl: z.string().trim().url().max(500).nullable().optional(),
});

export async function updateProfile(
  input: z.input<typeof profileSchema>,
): Promise<SettingsResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone?.trim() || null,
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      ...(parsed.data.avatarUrl !== undefined
        ? { avatar_url: parsed.data.avatarUrl }
        : {}),
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

const preferencesSchema = z.object({
  preferredChannel: z.enum(["email", "sms", "whatsapp", "viber", "push"]),
  reminderLeadMinutes: z.number().int().min(0).max(20160),
  notes: z.string().trim().max(2000).optional(),
  accessibilityNotes: z.string().trim().max(2000).optional(),
});

export async function updatePreferences(
  input: z.input<typeof preferencesSchema>,
): Promise<SettingsResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { ok: false, error: "unauthenticated" };

  const { error } = await supabase.from("customer_preferences").upsert(
    {
      profile_id: userId,
      preferred_channel: parsed.data.preferredChannel,
      reminder_lead_minutes: parsed.data.reminderLeadMinutes,
      notes: parsed.data.notes?.trim() || null,
      accessibility_notes: parsed.data.accessibilityNotes?.trim() || null,
    },
    { onConflict: "profile_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/settings", "page");
  return { ok: true };
}

const notificationSchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp", "viber", "push"]),
  eventType: z.enum([
    "booking_confirmation",
    "reminder",
    "cancellation",
    "reschedule",
    "review_request",
    "waitlist_offer",
    "marketing",
  ]),
  enabled: z.boolean(),
});

/**
 * Account-wide defaults (no business_id). The partial unique index treats a
 * null business_id as the all-zero uuid, so PostgREST cannot express the
 * conflict target - hence the explicit read-then-write.
 */
export async function setNotificationPreference(
  input: z.input<typeof notificationSchema>,
): Promise<SettingsResult> {
  const parsed = notificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { ok: false, error: "unauthenticated" };

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("id")
    .eq("profile_id", userId)
    .is("business_id", null)
    .eq("channel", parsed.data.channel)
    .eq("event_type", parsed.data.eventType)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("notification_preferences")
        .update({ enabled: parsed.data.enabled })
        .eq("id", existing.id)
    : await supabase.from("notification_preferences").insert({
        profile_id: userId,
        business_id: null,
        channel: parsed.data.channel,
        event_type: parsed.data.eventType,
        enabled: parsed.data.enabled,
      });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/settings", "page");
  return { ok: true };
}
