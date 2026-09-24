import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * The platform's Stripe client, or `null` when no key is configured.
 *
 * "Not configured" is a first-class state, like the assistant and email: the
 * payments page says so, and a service marked as needing a deposit is booked
 * without one rather than failing at the last step. Created lazily so a build
 * without the key never trips over it.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) {
    client = new Stripe(key, {
      appInfo: { name: "GLOWA", url: "https://glowa.bg" },
      maxNetworkRetries: 2,
    });
  }
  return client;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
