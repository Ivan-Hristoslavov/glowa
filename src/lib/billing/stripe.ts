import "server-only";

import { getStripe as platformStripe, isStripeConfigured } from "@/lib/payments/stripe";

/**
 * Subscriptions use the same platform Stripe client as deposits
 * (`lib/payments/stripe.ts`). Without a key the billing page says plans are
 * free during early access instead of showing buttons that would fail.
 */
export function isBillingConfigured() {
  return isStripeConfigured();
}

/** The platform client; only called after `isBillingConfigured()`. */
export function getStripe() {
  const stripe = platformStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe;
}
