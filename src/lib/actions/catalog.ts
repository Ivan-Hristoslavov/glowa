"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";

export type CatalogResult = { ok: true; id?: string } | { ok: false; code: string };

const localizedText = z.object({
  bg: z.string().trim().max(1000).optional(),
  en: z.string().trim().max(1000).optional(),
  ro: z.string().trim().max(1000).optional(),
});

function compactLocalized(value: z.infer<typeof localizedText>) {
  const entries = Object.entries(value).filter(([, text]) => text?.trim());
  return entries.length ? Object.fromEntries(entries) : null;
}

const serviceSchema = z.object({
  businessId: z.uuid(),
  serviceId: z.uuid().optional(),
  name: localizedText,
  description: localizedText,
  category: z.enum([
    "hair", "barber", "nails", "lashes_brows", "skincare",
    "makeup", "massage", "spa", "tattoo", "other",
  ]),
  durationMinutes: z.number().int().min(5).max(1440),
  bufferBeforeMinutes: z.number().int().min(0).max(240),
  bufferAfterMinutes: z.number().int().min(0).max(240),
  priceCents: z.number().int().min(0).max(100_000_00),
  requiresDeposit: z.boolean(),
  depositCents: z.number().int().min(0),
  isActive: z.boolean(),
  staffIds: z.array(z.uuid()).max(100),
});

export async function upsertService(
  input: z.input<typeof serviceSchema>,
): Promise<CatalogResult> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const name = compactLocalized(parsed.data.name);
  // The DB requires at least a Bulgarian name; say so before it raises.
  if (!name || !("bg" in name)) return { ok: false, code: "name_required" };

  const { data: business } = await guard.supabase
    .from("businesses")
    .select("currency")
    .eq("id", parsed.data.businessId)
    .maybeSingle();

  const payload = {
    business_id: parsed.data.businessId,
    name,
    description: compactLocalized(parsed.data.description),
    category: parsed.data.category,
    duration_minutes: parsed.data.durationMinutes,
    buffer_before_minutes: parsed.data.bufferBeforeMinutes,
    buffer_after_minutes: parsed.data.bufferAfterMinutes,
    price_cents: parsed.data.priceCents,
    currency: business?.currency ?? "EUR",
    requires_deposit: parsed.data.requiresDeposit,
    deposit_cents: parsed.data.requiresDeposit
      ? Math.min(parsed.data.depositCents, parsed.data.priceCents)
      : 0,
    is_active: parsed.data.isActive,
  };

  const { data, error } = parsed.data.serviceId
    ? await guard.supabase
        .from("services")
        .update(payload)
        .eq("id", parsed.data.serviceId)
        .eq("business_id", parsed.data.businessId)
        .select("id")
        .maybeSingle()
    : await guard.supabase.from("services").insert(payload).select("id").maybeSingle();

  if (error || !data) return { ok: false, code: "generic" };

  // Replace the staff mapping wholesale; it is a small set and this keeps the
  // UI's checkbox state the single source of truth.
  await guard.supabase.from("service_staff").delete().eq("service_id", data.id);
  if (parsed.data.staffIds.length > 0) {
    await guard.supabase.from("service_staff").insert(
      parsed.data.staffIds.map((staffProfileId) => ({
        service_id: data.id,
        staff_profile_id: staffProfileId,
      })),
    );
  }

  revalidatePath("/[locale]/dashboard/services", "page");
  return { ok: true, id: data.id };
}

export async function deleteService(
  businessId: string,
  serviceId: string,
): Promise<CatalogResult> {
  const guard = await requireMembership(businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("business_id", businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/services", "page");
  return { ok: true };
}

const staffSchema = z.object({
  businessId: z.uuid(),
  staffProfileId: z.uuid().optional(),
  displayName: z.string().trim().min(1).max(120),
  title: localizedText,
  bio: localizedText,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  isBookable: z.boolean(),
  workingHours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startsAt: z.string().regex(/^\d{2}:\d{2}$/),
        endsAt: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(21),
});

export async function upsertStaff(
  input: z.input<typeof staffSchema>,
): Promise<CatalogResult> {
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const payload = {
    business_id: parsed.data.businessId,
    display_name: parsed.data.displayName,
    title: compactLocalized(parsed.data.title),
    bio: compactLocalized(parsed.data.bio),
    color: parsed.data.color.toUpperCase(),
    is_bookable: parsed.data.isBookable,
  };

  const { data, error } = parsed.data.staffProfileId
    ? await guard.supabase
        .from("staff_profiles")
        .update(payload)
        .eq("id", parsed.data.staffProfileId)
        .eq("business_id", parsed.data.businessId)
        .select("id")
        .maybeSingle()
    : await guard.supabase
        .from("staff_profiles")
        .insert(payload)
        .select("id")
        .maybeSingle();

  if (error || !data) return { ok: false, code: "generic" };

  const { data: primaryLocation } = await guard.supabase
    .from("locations")
    .select("id")
    .eq("business_id", parsed.data.businessId)
    .eq("is_primary", true)
    .maybeSingle();

  await guard.supabase
    .from("staff_working_hours")
    .delete()
    .eq("staff_profile_id", data.id);

  const rows = parsed.data.workingHours.filter((row) => row.endsAt > row.startsAt);
  if (rows.length > 0) {
    await guard.supabase.from("staff_working_hours").insert(
      rows.map((row) => ({
        staff_profile_id: data.id,
        location_id: primaryLocation?.id ?? null,
        day_of_week: row.dayOfWeek,
        starts_at: row.startsAt,
        ends_at: row.endsAt,
      })),
    );
  }

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { ok: true, id: data.id };
}

export async function deleteStaff(
  businessId: string,
  staffProfileId: string,
): Promise<CatalogResult> {
  const guard = await requireMembership(businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("staff_profiles")
    .delete()
    .eq("id", staffProfileId)
    .eq("business_id", businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/staff", "page");
  return { ok: true };
}

const inviteSchema = z.object({
  businessId: z.uuid(),
  email: z.email(),
  role: z.enum(["admin", "manager", "staff"]),
});

/**
 * Records the invitation as a membership row in `invited` state. Access starts
 * when that person signs in with the same address and the row is matched to
 * their profile - there is no token to leak in the meantime.
 */
export async function inviteMember(
  input: z.input<typeof inviteSchema>,
): Promise<CatalogResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.from("business_members").insert({
    business_id: parsed.data.businessId,
    invited_email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    status: "invited",
  });

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/staff", "page");
  return { ok: true };
}

const timeOffSchema = z.object({
  businessId: z.uuid(),
  staffProfileId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().max(200).optional(),
});

export async function addTimeOff(
  input: z.input<typeof timeOffSchema>,
): Promise<CatalogResult> {
  const parsed = timeOffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  if (parsed.data.endsAt <= parsed.data.startsAt) {
    return { ok: false, code: "invalid_range" };
  }

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.from("staff_time_off").insert({
    staff_profile_id: parsed.data.staffProfileId,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    reason: parsed.data.reason || null,
  });

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { ok: true };
}

export async function deleteTimeOff(
  businessId: string,
  timeOffId: string,
): Promise<CatalogResult> {
  const guard = await requireMembership(businessId, "manager");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("staff_time_off")
    .delete()
    .eq("id", timeOffId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/staff", "page");
  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { ok: true };
}
