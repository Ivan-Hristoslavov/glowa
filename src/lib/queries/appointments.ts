import "server-only";

import { createClient } from "@/lib/supabase/server";

const APPOINTMENT_SELECT = `
  id, starts_at, ends_at, status, price_cents, currency, customer_notes,
  cancellation_reason, service_name_snapshot, business_id, service_id,
  staff_profile_id, location_id,
  businesses ( id, slug, name, timezone, logo_url, google_review_url, booking_policy, phone ),
  services ( id, name, duration_minutes ),
  staff_profiles ( id, display_name, avatar_url ),
  locations ( id, name, address_line1, city ),
  reviews ( id, rating, comment, created_at )
` as const;

export async function listMyAppointments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .order("starts_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const now = Date.now();
  const rows = data ?? [];

  return {
    upcoming: rows
      .filter(
        (row) =>
          new Date(row.starts_at).getTime() >= now &&
          (row.status === "pending" || row.status === "confirmed"),
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    past: rows.filter(
      (row) =>
        new Date(row.starts_at).getTime() < now ||
        row.status === "completed" ||
        row.status === "cancelled" ||
        row.status === "no_show",
    ),
  };
}

export async function getMyAppointment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type AppointmentRow = NonNullable<
  Awaited<ReturnType<typeof getMyAppointment>>
>;

export async function listSavedBusinesses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_businesses")
    .select(
      `
      created_at,
      businesses (
        id, slug, name, short_pitch, category, logo_url, cover_image_url, currency,
        locations ( city, is_primary )
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).filter((row) => row.businesses !== null);
}

export async function listMyReviews() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id, rating, comment, status, created_at, business_response, responded_at,
      businesses ( id, slug, name, logo_url ),
      appointments ( id, starts_at, service_name_snapshot )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

type WindowInput = {
  starts_at: string;
  status: AppointmentRow["status"];
  service_id: string | null;
  businesses: { booking_policy: unknown } | null;
};

export type AppointmentWindow = {
  isUpcoming: boolean;
  isOpen: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  hasHappened: boolean;
  cancellationWindowHours: number;
};

/**
 * Mirrors the rules the database enforces (see app.enforce_customer_booking_fields
 * and public.reschedule_appointment) so the UI only offers actions that will
 * actually succeed. The database, not this function, is the authority.
 */
export function describeAppointmentWindow(
  appointment: WindowInput,
  now = Date.now(),
): AppointmentWindow {
  const raw = appointment.businesses?.booking_policy;
  const policy =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as { cancellation_window_hours?: number; allow_customer_reschedule?: boolean })
      : {};

  const cancellationWindowHours = policy.cancellation_window_hours ?? 24;
  const startsAtMs = new Date(appointment.starts_at).getTime();
  const isUpcoming = startsAtMs > now;
  const isOpen = appointment.status === "pending" || appointment.status === "confirmed";
  const windowOpen = startsAtMs - cancellationWindowHours * 3_600_000 > now;
  const canCancel = isOpen && isUpcoming && windowOpen;

  return {
    isUpcoming,
    isOpen,
    canCancel,
    canReschedule:
      canCancel &&
      policy.allow_customer_reschedule !== false &&
      Boolean(appointment.service_id),
    hasHappened:
      appointment.status === "completed" ||
      (appointment.status === "confirmed" && !isUpcoming),
    cancellationWindowHours,
  };
}
