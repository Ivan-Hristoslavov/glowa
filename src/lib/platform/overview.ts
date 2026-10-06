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
