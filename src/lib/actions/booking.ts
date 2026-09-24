"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { GROWTH_COOKIE } from "@/lib/growth/cookie";
import { createClient } from "@/lib/supabase/server";

export type Slot = {
  starts_at: string;
  ends_at: string;
  staff_profile_id: string | null;
};

export type SlotsResult =
  | { ok: true; slots: Slot[] }
  | { ok: false; code: string };

export type BookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; code: string };

/**
 * PostgREST surfaces our `raise … using hint = '…'` as `hint`, which is what
 * the UI maps to a localized message. Everything else collapses to `generic`
 * so a raw Postgres string is never shown to a customer.
 */
function errorCode(error: { hint?: string | null } | null) {
  return error?.hint ?? "generic";
}

export async function fetchSlots(input: {
  serviceId: string;
  from: string;
  to: string;
  staffProfileId?: string | null;
  locationId?: string | null;
}): Promise<SlotsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_service_id: input.serviceId,
    p_from: input.from,
    p_to: input.to,
    p_staff_profile_id: input.staffProfileId ?? undefined,
    p_location_id: input.locationId ?? undefined,
  });

  if (error) return { ok: false, code: errorCode(error) };
  return { ok: true, slots: data ?? [] };
}

export async function bookAppointment(input: {
  serviceId: string;
  startsAt: string;
  staffProfileId: string;
  locationId?: string | null;
  notes?: string | null;
}): Promise<BookingResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") {
    return { ok: false, code: "unauthenticated" };
  }

  // Set when the customer arrived through a QR or referral link. The RPC
  // resolves it against the business being booked, so a code from elsewhere
  // is simply ignored rather than credited.
  const jar = await cookies();
  const growthCode = jar.get(GROWTH_COOKIE)?.value;

  const { data, error } = await supabase.rpc("book_appointment", {
    p_service_id: input.serviceId,
    p_starts_at: input.startsAt,
    p_staff_profile_id: input.staffProfileId,
    p_location_id: input.locationId ?? undefined,
    p_customer_notes: input.notes ?? undefined,
    p_growth_code: growthCode || undefined,
  });

  if (error || !data) return { ok: false, code: errorCode(error) };

  revalidatePath("/[locale]/bookings", "page");
  revalidatePath("/[locale]/profile", "page");
  return { ok: true, appointmentId: data.id };
}

export async function cancelAppointment(
  appointmentId: string,
  reason?: string,
): Promise<BookingResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: appointmentId,
    p_reason: reason?.trim() || undefined,
  });

  if (error || !data) return { ok: false, code: errorCode(error) };

  revalidatePath("/[locale]/bookings", "page");
  revalidatePath("/[locale]/profile", "page");
  return { ok: true, appointmentId: data.id };
}

export async function rescheduleAppointment(input: {
  appointmentId: string;
  startsAt: string;
  staffProfileId?: string | null;
}): Promise<BookingResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: input.appointmentId,
    p_new_starts_at: input.startsAt,
    p_new_staff_profile_id: input.staffProfileId ?? undefined,
  });

  if (error || !data) return { ok: false, code: errorCode(error) };

  revalidatePath("/[locale]/bookings", "page");
  revalidatePath("/[locale]/profile", "page");
  return { ok: true, appointmentId: data.id };
}
