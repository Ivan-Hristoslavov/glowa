import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type BusinessRole = Database["public"]["Enums"]["business_role"];

/** Which business the admin surfaces are pointed at, when a user has several. */
export const ACTIVE_BUSINESS_COOKIE = "glowa_business";

export type Membership = {
  businessId: string;
  role: BusinessRole;
  name: string;
  slug: string;
  status: Database["public"]["Enums"]["business_status"];
  logoUrl: string | null;
};

/**
 * Turns any invitation addressed to the caller's own verified email into a
 * real membership. Cheap and idempotent, so it is safe to call on the paths
 * where a new member would first appear: right after sign-in, and when the
 * business shell finds no membership and is about to send them to onboarding.
 */
export async function claimPendingInvitations(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_pending_invitations");
  if (error) return 0;
  return data ?? 0;
}

export async function listMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_members")
    .select("business_id, role, businesses ( id, name, slug, status, logo_url )")
    .eq("status", "active")
    .order("created_at");

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.businesses !== null)
    .map((row) => ({
      businessId: row.business_id,
      role: row.role,
      name: row.businesses!.name,
      slug: row.businesses!.slug,
      status: row.businesses!.status,
      logoUrl: row.businesses!.logo_url,
    }));
}

/**
 * The membership the admin is currently working in. Falls back to the first
 * one, so a stale or forged cookie can never point at a business the caller is
 * not a member of - the value is only ever used to pick from this list.
 */
export async function getActiveMembership(): Promise<Membership | null> {
  const memberships = await listMemberships();
  if (memberships.length === 0) return null;

  const jar = await cookies();
  const preferred = jar.get(ACTIVE_BUSINESS_COOKIE)?.value;

  return (
    memberships.find((membership) => membership.businessId === preferred) ??
    memberships[0]
  );
}

export function canManage(role: BusinessRole) {
  return role === "owner" || role === "admin" || role === "manager";
}

export function canAdminister(role: BusinessRole) {
  return role === "owner" || role === "admin";
}

export async function getBusinessWorkspace(businessId: string) {
  const supabase = await createClient();

  const [{ data: business }, { data: locations }, { data: staff }, { data: services }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select(
          `id, slug, name, description, short_pitch, category, logo_url, cover_image_url,
           email, phone, website, currency, timezone, default_locale, booking_policy,
           google_review_url, status, is_demo`,
        )
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("locations")
        .select(
          `id, name, address_line1, city, postal_code, country_code, timezone,
           is_primary, is_active,
           business_hours ( id, day_of_week, opens_at, closes_at )`,
        )
        .eq("business_id", businessId)
        .order("is_primary", { ascending: false }),
      supabase
        .from("staff_profiles")
        .select(
          `id, display_name, title, bio, avatar_url, color, is_bookable, sort_order, member_id,
           business_members ( id, role, status, profile_id, invited_email ),
           staff_working_hours ( id, day_of_week, starts_at, ends_at, location_id ),
           service_staff ( service_id )`,
        )
        .eq("business_id", businessId)
        .order("sort_order"),
      supabase
        .from("services")
        .select(
          `id, name, description, category, duration_minutes, buffer_before_minutes,
           buffer_after_minutes, price_cents, currency, requires_deposit, deposit_cents,
           is_active, sort_order, service_staff ( staff_profile_id )`,
        )
        .eq("business_id", businessId)
        .order("sort_order"),
    ]);

  return {
    business,
    locations: locations ?? [],
    staff: staff ?? [],
    services: services ?? [],
  };
}

export type BusinessWorkspace = Awaited<ReturnType<typeof getBusinessWorkspace>>;

export async function getDashboardMetrics(
  businessId: string,
  from: Date,
  to: Date,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_business_dashboard", {
      p_business_id: businessId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    })
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type DashboardMetrics = NonNullable<
  Awaited<ReturnType<typeof getDashboardMetrics>>
>;

const ADMIN_APPOINTMENT_SELECT = `
  id, starts_at, ends_at, status, price_cents, currency, customer_name,
  customer_email, customer_phone, customer_notes, internal_notes,
  cancellation_reason, service_name_snapshot, service_id, staff_profile_id,
  location_id, customer_profile_id, source,
  services ( id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes ),
  staff_profiles ( id, display_name, color, avatar_url ),
  locations ( id, name )
` as const;

export async function listAppointmentsInRange(
  businessId: string,
  from: Date,
  to: Date,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(ADMIN_APPOINTMENT_SELECT)
    .eq("business_id", businessId)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");

  if (error) throw error;
  return data ?? [];
}

export type AdminAppointment = Awaited<
  ReturnType<typeof listAppointmentsInRange>
>[number];

export async function listBusinessClients(businessId: string, query?: string) {
  const supabase = await createClient();
  let request = supabase
    .from("business_clients")
    .select(
      `id, full_name, email, phone, notes, tags, consent_marketing, consent_updated_at,
       first_visit_at, last_visit_at, total_visits, total_spend_cents, profile_id`,
    )
    .eq("business_id", businessId)
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (query?.trim()) {
    const term = `%${query.trim()}%`;
    request = request.or(
      `full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export type BusinessClient = Awaited<
  ReturnType<typeof listBusinessClients>
>[number];

export async function getBusinessClient(businessId: string, clientId: string) {
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("business_clients")
    .select(
      `id, full_name, email, phone, notes, tags, consent_marketing, consent_updated_at,
       first_visit_at, last_visit_at, total_visits, total_spend_cents, profile_id`,
    )
    .eq("business_id", businessId)
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw error;
  if (!client) return null;

  // Match the client's appointments the same way the CRM trigger does.
  let history = supabase
    .from("appointments")
    .select(ADMIN_APPOINTMENT_SELECT)
    .eq("business_id", businessId)
    .order("starts_at", { ascending: false })
    .limit(50);

  history = client.profile_id
    ? history.eq("customer_profile_id", client.profile_id)
    : client.email
      ? history.ilike("customer_email", client.email)
      : history.eq("customer_phone", client.phone ?? "");

  const { data: appointments } = await history;

  return { ...client, appointments: appointments ?? [] };
}

export async function listBusinessReviews(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `id, rating, comment, status, business_response, responded_at, created_at,
       staff_profiles ( id, display_name ),
       appointments ( id, starts_at, service_name_snapshot, customer_name )`,
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function listPaymentRecords(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_records")
    .select(
      `id, kind, status, amount_cents, currency, provider, provider_reference,
       failure_reason, created_at,
       appointments ( id, starts_at, customer_name, service_name_snapshot )`,
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function listCampaigns(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select(
      `id, name, type, status, channel, audience, template, scheduled_at, sent_at,
       stats, created_at`,
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function previewAudience(businessId: string, audience: unknown) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_campaign_audience", {
    p_business_id: businessId,
    p_audience: (audience ?? {}) as never,
    p_limit: 50,
  });

  if (error) throw error;
  return data ?? [];
}

export async function listGrowthLinks(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("growth_links")
    .select(
      `id, code, kind, label, target, service_id, is_active,
       visit_count, booking_count, created_at,
       services ( name ),
       business_clients ( full_name )`,
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

export type GrowthLinkRow = Awaited<ReturnType<typeof listGrowthLinks>>[number];

export type CampaignStats = {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Per-campaign delivery counts, read from the outbox rather than stored on the
 * campaign. A stored counter drifts the moment a retry succeeds; this cannot.
 */
export async function listCampaignStats(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("campaign_id, status")
    .eq("business_id", businessId)
    .eq("event_type", "marketing")
    .not("campaign_id", "is", null)
    .limit(10_000);

  if (error) throw error;

  const byCampaign = new Map<string, CampaignStats>();
  for (const row of data ?? []) {
    if (!row.campaign_id) continue;
    const stats =
      byCampaign.get(row.campaign_id) ??
      { queued: 0, sent: 0, failed: 0, skipped: 0 };
    // `sending` is in flight, which reads as queued to anyone looking at it.
    const bucket = row.status === "sending" ? "queued" : row.status;
    if (bucket in stats) stats[bucket as keyof CampaignStats] += 1;
    byCampaign.set(row.campaign_id, stats);
  }
  return byCampaign;
}

export async function listWaitlist(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select(
      `id, status, from_date, to_date, note, created_at, offered_at,
       profiles ( full_name ),
       services ( name ),
       staff_profiles ( display_name )`,
    )
    .eq("business_id", businessId)
    .in("status", ["waiting", "offered"])
    .order("created_at")
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export type WaitlistRow = Awaited<ReturnType<typeof listWaitlist>>[number];
