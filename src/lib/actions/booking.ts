"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { GROWTH_COOKIE } from "@/app/[locale]/go/[code]/route";
import { routing } from "@/i18n/routing";
import {
  openDepositCheckout,
  releaseUnpaidDeposit,
  runPaymentsMaintenance,
} from "@/lib/payments/deposits";
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

/** A booking that needs a deposit comes back with the page to pay it on. */
export type NewBookingResult =
  | { ok: true; appointmentId: string; checkoutUrl: string | null }
  | { ok: false; code: string };

const localeSchema = z.enum(routing.locales);

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
  locale: string;
}): Promise<NewBookingResult> {
  const locale = localeSchema.safeParse(input.locale);
  if (!locale.success) return { ok: false, code: "invalid" };

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

  if (data.deposit_status !== "awaiting") {
    return { ok: true, appointmentId: data.id, checkoutUrl: null };
  }

  // The slot is held; now the deposit that secures it. If the payment page
  // cannot be opened the hold is let go at once - a slot nobody can pay for
  // should not sit blocked for half an hour.
  try {
    const checkout = await openDepositCheckout(data.id, locale.data);
    if (checkout.ok) {
      return { ok: true, appointmentId: data.id, checkoutUrl: checkout.url };
    }
  } catch (cause) {
    console.error("booking: deposit checkout failed", cause);
  }

  await releaseUnpaidDeposit(data.id, "deposit_checkout_failed").catch(() => undefined);
  return { ok: false, code: "payment_unavailable" };
}

/**
 * "Pay the deposit" from the booking page, for a customer who left Checkout
 * before paying and came back while the slot is still held.
 */
export async function resumeDepositCheckout(input: {
  appointmentId: string;
  locale: string;
}): Promise<{ ok: true; url: string } | { ok: false; code: string }> {
  const locale = localeSchema.safeParse(input.locale);
  const id = z.uuid().safeParse(input.appointmentId);
  if (!locale.success || !id.success) return { ok: false, code: "invalid" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { ok: false, code: "unauthenticated" };

  // RLS also shows a salon's own staff this row; only the customer pays.
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, customer_profile_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!appointment || appointment.customer_profile_id !== userId) {
    return { ok: false, code: "not_found" };
  }

  const checkout = await openDepositCheckout(appointment.id, locale.data);
  return checkout.ok ? checkout : { ok: false, code: checkout.code };
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

  // A paid deposit was queued for refund in the same transaction. Issue it
  // now rather than on the next scheduled run, so the money is on its way
  // before the customer has closed the page.
  if (data.deposit_status === "refund_pending") {
    after(() => runPaymentsMaintenance(5).then(() => undefined, () => undefined));
  }

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
