import type { PlanId } from "@/lib/pricing";

export type BillingInterval = "month" | "year";

/**
 * Stripe prices are found by lookup key, not by ID, so no price ID lives in
 * the environment and `scripts/stripe-setup.ts` can create them in any
 * Stripe account (test or live) with the same keys: `glowa_studio_year`.
 */
export function priceLookupKey(plan: PlanId, interval: BillingInterval) {
  return `glowa_${plan}_${interval}`;
}

export function parsePriceLookupKey(
  key: string | null | undefined,
): { plan: PlanId; interval: BillingInterval } | null {
  const match = /^glowa_(solo|studio|salon)_(month|year)$/.exec(key ?? "");
  if (!match) return null;
  return { plan: match[1] as PlanId, interval: match[2] as BillingInterval };
}

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses in which the salon has a working paid plan. */
export function isLiveSubscription(status: string | null | undefined) {
  return status === "active" || status === "trialing" || status === "past_due";
}
