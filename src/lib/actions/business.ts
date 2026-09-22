"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routing } from "@/i18n/routing";
import { requireMembership } from "@/lib/actions/guard";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export type BusinessActionResult =
  | { ok: true; slug?: string }
  | { ok: false; code: string };

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(BUSINESS_CATEGORIES),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(32).optional(),
  timezone: z.string().trim().min(1).max(64),
  currency: z.string().trim().length(3),
  locale: z.enum(routing.locales),
});

export async function createBusiness(
  input: z.input<typeof createSchema>,
): Promise<BusinessActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "name_required" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_business", {
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_city: parsed.data.city ?? "",
    p_address: parsed.data.address ?? undefined,
    p_phone: parsed.data.phone ?? undefined,
    p_timezone: parsed.data.timezone,
    p_currency: parsed.data.currency.toUpperCase(),
    p_locale: parsed.data.locale,
  });

  if (error || !data) return { ok: false, code: error?.hint ?? "generic" };

  const jar = await cookies();
  jar.set(ACTIVE_BUSINESS_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true, slug: data.slug };
}

/**
 * Only records a preference. `getActiveMembership` still picks from the
 * caller's real memberships, so a tampered cookie selects nothing.
 */
export async function setActiveBusiness(
  businessId: string,
): Promise<BusinessActionResult> {
  const guard = await requireMembership(businessId, "member");
  if (!guard.ok) return guard;

  const jar = await cookies();
  jar.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}

export async function publishBusiness(
  businessId: string,
): Promise<BusinessActionResult> {
  const guard = await requireMembership(businessId, "admin");
  if (!guard.ok) return guard;

  // A business with nothing to book would be a dead search result.
  const { count } = await guard.supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_active", true);

  if (!count) return { ok: false, code: "no_services" };

  const { error } = await guard.supabase
    .from("businesses")
    .update({ status: "active" })
    .eq("id", businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard", "layout");
  revalidatePath("/[locale]/search", "page");
  return { ok: true };
}

const settingsSchema = z.object({
  businessId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).optional(),
  email: z.email().optional().or(z.literal("")),
  website: z.url().optional().or(z.literal("")),
  googleReviewUrl: z.url().optional().or(z.literal("")),
  description: z.object({
    bg: z.string().trim().max(2000).optional(),
    en: z.string().trim().max(2000).optional(),
    ro: z.string().trim().max(2000).optional(),
  }),
  cancellationWindowHours: z.number().int().min(0).max(336),
  minLeadMinutes: z.number().int().min(0).max(43200),
  maxAdvanceDays: z.number().int().min(1).max(365),
  allowCustomerReschedule: z.boolean(),
});

export async function updateBusinessSettings(
  input: z.input<typeof settingsSchema>,
): Promise<BusinessActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const description = Object.fromEntries(
    Object.entries(parsed.data.description).filter(([, value]) => value?.trim()),
  );

  const { error } = await guard.supabase
    .from("businesses")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      google_review_url: parsed.data.googleReviewUrl || null,
      description: Object.keys(description).length ? description : null,
      booking_policy: {
        cancellation_window_hours: parsed.data.cancellationWindowHours,
        min_lead_minutes: parsed.data.minLeadMinutes,
        max_advance_days: parsed.data.maxAdvanceDays,
        allow_customer_reschedule: parsed.data.allowCustomerReschedule,
      },
    })
    .eq("id", parsed.data.businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}
