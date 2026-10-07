import "server-only";

import { PLANS, type PlanId } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export type DailyPoint = {
  day: string;
  businesses: number;
  users: number;
  bookings: number;
  online_bookings: number;
  booked_cents: number;
};

export type SalonRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "suspended" | "archived" | string;
  category: string;
  city: string | null;
  created_at: string;
  services: number;
  team: number;
  clients: number;
  bookings_total: number;
  bookings_30d: number;
  last_booking_at: string | null;
  plan: PlanId | null;
  interval: "month" | "year" | null;
  subscription_status: string | null;
  period_end: string | null;
};

export type SubscriptionGroup = {
  plan: PlanId;
  interval: "month" | "year";
  status: string;
  count: number;
};

export type PlatformOverview = {
  generated_at: string;
  days: number;
  totals: {
    businesses: number;
    active_businesses: number;
    users: number;
    appointments: number;
    appointments_30d: number;
    booked_cents_30d: number;
    online_share_30d: number | null;
  };
  daily: DailyPoint[];
  by_status: Record<string, number>;
  by_category: Array<{ category: string; count: number }>;
  subscriptions: SubscriptionGroup[];
  salons: SalonRow[];
  /** Derived here from the plan table, not stored anywhere. */
  revenue: { mrrCents: number; trialMrrCents: number; payingSalons: number; trialingSalons: number };
};

export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return false;
  const { data } = await supabase
    .from("platform_admins")
    .select("profile_id")
    .eq("profile_id", claims.claims.sub)
    .maybeSingle();
  return Boolean(data);
}

function monthlyCents(plan: PlanId, interval: "month" | "year") {
  const row = PLANS.find((item) => item.id === plan);
  return (interval === "year" ? row?.annualMonthly : row?.monthly) ?? 0;
}

/**
 * The console's one data call. The SQL function refuses anyone who is not in
 * `platform_admins`; the page checks too, but this is the line that holds.
 * Revenue is an estimate from list prices (no coupons, no VAT) - Stripe is the
 * ledger.
 */
export async function getPlatformOverview(days = 365): Promise<PlatformOverview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview", { p_days: days });
  if (error || !data) return null;

  const overview = data as unknown as Omit<PlatformOverview, "revenue">;
  let mrrCents = 0;
  let trialMrrCents = 0;
  let payingSalons = 0;
  let trialingSalons = 0;
  for (const group of overview.subscriptions) {
    const value = monthlyCents(group.plan, group.interval) * group.count;
    if (group.status === "active" || group.status === "past_due") {
      mrrCents += value;
      payingSalons += group.count;
    } else if (group.status === "trialing") {
      trialMrrCents += value;
      trialingSalons += group.count;
    }
  }
  return { ...overview, revenue: { mrrCents, trialMrrCents, payingSalons, trialingSalons } };
}

// --- Moderation, people, problems and the audit log --------------------------

export type ContentSalon = {
  id: string;
  name: string;
  slug: string;
  status: string;
  logo_url: string | null;
  cover_url: string | null;
  gallery: string[];
  description: unknown;
  created_at: string;
};

export type ContentReview = {
  id: string;
  business_id: string;
  business_name: string;
  rating: number;
  comment: string | null;
  response: string | null;
  status: "published" | "pending" | "hidden";
  created_at: string;
};

export type PlatformUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  bookings: number;
  salons: Array<{ name: string; role: string }>;
  is_platform_admin: boolean;
};

export type FailedMessage = {
  id: string;
  event: string;
  channel: string;
  attempts: number;
  error: string | null;
  business_id: string | null;
  business_name: string | null;
  updated_at: string;
};

export type PaymentProblem = {
  id: string;
  kind: string;
  status: string;
  amount_cents: number;
  currency: string;
  reason: string | null;
  business_name: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  admin_email: string | null;
};

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const supabase = await createClient();
  // The generated types know each function's exact arguments; this helper is
  // deliberately loose because every call here is typed at its use site.
  const { data, error } = await (supabase.rpc as unknown as (
    name: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>)(fn, args);
  if (error) return null;
  return data as T;
}

export const getPlatformContent = () =>
  call<{ salons: ContentSalon[]; reviews: ContentReview[] }>("platform_content", { p_limit: 40 });

export const getPlatformUsers = (query: string) =>
  call<PlatformUser[]>("platform_users", { p_query: query || null, p_limit: 50 });

export const getPlatformProblems = () =>
  call<{
    failed_messages: FailedMessage[];
    stuck_messages: number;
    payments: PaymentProblem[];
    summary: { failed_messages_7d: number; sent_messages_7d: number };
  }>("platform_problems");

export const getPlatformAudit = () => call<AuditEntry[]>("platform_audit", { p_limit: 100 });

export type ErrorGroup = {
  fingerprint: string;
  message: string;
  path: string | null;
  source: "server" | "client";
  count: number;
  count_24h: number;
  first_seen: string;
  last_seen: string;
};

export type SupportTicket = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  subject: string;
  message: string;
  page: string | null;
  status: "open" | "done";
  business_name: string | null;
};

export const getPlatformErrors = () => call<ErrorGroup[]>("platform_errors", { p_limit: 100 });
export const getPlatformSupport = () => call<SupportTicket[]>("platform_support", { p_limit: 100 });
