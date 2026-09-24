"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { mapWriteError, requireMembership } from "@/lib/actions/guard";
import { runPaymentsMaintenance } from "@/lib/payments/deposits";

export type AdminAppointmentResult =
  | { ok: true; id?: string }
  | { ok: false; code: string };

const createSchema = z.object({
  businessId: z.uuid(),
  serviceId: z.uuid(),
  staffProfileId: z.uuid(),
  locationId: z.uuid().nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }),
  customerName: z.string().trim().max(120).optional(),
  customerEmail: z.email().optional().or(z.literal("")),
  customerPhone: z.string().trim().max(32).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
});

/**
 * Staff-side booking. Members bypass the customer guard trigger by design - a
 * salon must be able to enter a walk-in at a price or time the public rules
 * would refuse - so duration and price are resolved here from the service and
 * the exclusion constraint still prevents an overlap.
 */
export async function createAdminAppointment(
  input: z.input<typeof createSchema>,
): Promise<AdminAppointmentResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { data: service } = await guard.supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, currency")
    .eq("id", parsed.data.serviceId)
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();

  if (!service) return { ok: false, code: "invalid" };

  if (
    !parsed.data.customerName &&
    !parsed.data.customerEmail &&
    !parsed.data.customerPhone
  ) {
    return { ok: false, code: "customer_required" };
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);

  const { data, error } = await guard.supabase
    .from("appointments")
    .insert({
      business_id: parsed.data.businessId,
      service_id: service.id,
      staff_profile_id: parsed.data.staffProfileId,
      location_id: parsed.data.locationId ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      source: "business_admin",
      price_cents: service.price_cents,
      currency: service.currency,
      service_name_snapshot: service.name,
      customer_name: parsed.data.customerName || null,
      customer_email: parsed.data.customerEmail || null,
      customer_phone: parsed.data.customerPhone || null,
      internal_notes: parsed.data.internalNotes || null,
      created_by: guard.userId,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, code: mapWriteError(error) };

  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/dashboard", "page");
  return { ok: true, id: data.id };
}

const statusSchema = z.object({
  businessId: z.uuid(),
  appointmentId: z.uuid(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
  reason: z.string().trim().max(500).optional(),
  // A late cancellation phoned in: the salon may keep a paid deposit instead
  // of refunding it. The database only honours this for a member.
  retainDeposit: z.boolean().optional(),
});

export async function setAppointmentStatus(
  input: z.input<typeof statusSchema>,
): Promise<AdminAppointmentResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "member");
  if (!guard.ok) return guard;

  const now = new Date().toISOString();
  const isCancel = parsed.data.status === "cancelled";
  const { data: updated, error } = await guard.supabase
    .from("appointments")
    .update({
      status: parsed.data.status,
      cancellation_reason: isCancel ? parsed.data.reason || null : null,
      cancelled_at: isCancel ? now : null,
      completed_at: parsed.data.status === "completed" ? now : null,
      ...(isCancel && parsed.data.retainDeposit
        ? { deposit_status: "retained" as const }
        : {}),
    })
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", parsed.data.businessId)
    .select("deposit_status")
    .maybeSingle();

  if (error) return { ok: false, code: mapWriteError(error) };

  if (updated?.deposit_status === "refund_pending") {
    after(() => runPaymentsMaintenance(5).then(() => undefined, () => undefined));
  }

  revalidatePath("/[locale]/dashboard/calendar", "page");
  revalidatePath("/[locale]/dashboard", "page");
  return { ok: true };
}

const moveSchema = z.object({
  businessId: z.uuid(),
  appointmentId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  staffProfileId: z.uuid().optional(),
});

/** Drag/drop on the calendar. Duration is preserved; overlaps are refused. */
export async function moveAppointment(
  input: z.input<typeof moveSchema>,
): Promise<AdminAppointmentResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { data: existing } = await guard.supabase
    .from("appointments")
    .select("id, starts_at, ends_at, staff_profile_id")
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();

  if (!existing) return { ok: false, code: "invalid" };

  const durationMs =
    new Date(existing.ends_at).getTime() - new Date(existing.starts_at).getTime();
  const startsAt = new Date(parsed.data.startsAt);

  const { error } = await guard.supabase
    .from("appointments")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + durationMs).toISOString(),
      staff_profile_id: parsed.data.staffProfileId ?? existing.staff_profile_id,
    })
    .eq("id", parsed.data.appointmentId);

  if (error) return { ok: false, code: mapWriteError(error) };

  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { ok: true };
}

const notesSchema = z.object({
  businessId: z.uuid(),
  appointmentId: z.uuid(),
  internalNotes: z.string().trim().max(2000),
});

export async function setAppointmentNotes(
  input: z.input<typeof notesSchema>,
): Promise<AdminAppointmentResult> {
  const parsed = notesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "member");
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("appointments")
    .update({ internal_notes: parsed.data.internalNotes || null })
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", parsed.data.businessId);

  if (error) return { ok: false, code: "generic" };

  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { ok: true };
}

const resizeSchema = z.object({
  businessId: z.uuid(),
  appointmentId: z.uuid(),
  // 5 minutes is the shortest thing anyone books; a day is the longest.
  durationMinutes: z.number().int().min(5).max(1440),
});

/**
 * Dragging an appointment's bottom edge.
 *
 * Only the end moves - the start is where the client was told to arrive, and
 * changing it from a resize handle would be a surprise. The exclusion
 * constraint decides whether the new length fits, so a stylist cannot be
 * stretched over their next client.
 */
export async function resizeAppointment(
  input: z.input<typeof resizeSchema>,
): Promise<AdminAppointmentResult> {
  const parsed = resizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  const { data: existing } = await guard.supabase
    .from("appointments")
    .select("id, starts_at")
    .eq("id", parsed.data.appointmentId)
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();

  if (!existing) return { ok: false, code: "invalid" };

  const endsAt = new Date(
    new Date(existing.starts_at).getTime() + parsed.data.durationMinutes * 60_000,
  );

  const { error } = await guard.supabase
    .from("appointments")
    .update({ ends_at: endsAt.toISOString() })
    .eq("id", parsed.data.appointmentId);

  if (error) return { ok: false, code: mapWriteError(error) };

  revalidatePath("/[locale]/dashboard/calendar", "page");
  return { ok: true };
}
