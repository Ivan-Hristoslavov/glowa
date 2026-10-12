import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

export const BOOKING_SELECT = `
  id, status, source, starts_at, ends_at, price_cents, currency, external_ref,
  customer_name, customer_email, customer_phone, customer_notes,
  created_at, updated_at,
  services ( id, external_id, name ),
  staff_profiles ( id, display_name )
` as const;

type BookingRow = {
  id: string;
  status: string;
  source: string;
  starts_at: string;
  ends_at: string;
  price_cents: number;
  currency: string;
  external_ref: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
  services: { id: string; external_id: string | null; name: unknown } | null;
  staff_profiles: { id: string; display_name: string } | null;
};

/** The same shape the webhooks send (see `app.booking_json`). */
export function toBookingJson(row: BookingRow) {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    price_cents: row.price_cents,
    currency: row.currency,
    external_ref: row.external_ref,
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    notes: row.customer_notes,
    service: row.services
      ? { id: row.services.id, external_id: row.services.external_id, name: row.services.name }
      : null,
    staff: row.staff_profiles ? { id: row.staff_profiles.id, name: row.staff_profiles.display_name } : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function loadBooking(
  db: ReturnType<typeof createAdminClient>,
  businessId: string,
  id: string,
) {
  const { data } = await db
    .from("appointments")
    .select(BOOKING_SELECT)
    .eq("id", id)
    .eq("business_id", businessId)
    .eq("is_demo", false)
    .maybeSingle();
  return data ? toBookingJson(data as unknown as BookingRow) : null;
}

export type { BookingRow };
