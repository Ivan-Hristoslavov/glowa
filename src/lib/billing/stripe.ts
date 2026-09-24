import "server-only";

import Stripe from "stripe";

import { requireServerEnv } from "@/lib/env";

/**
 * Billing is optional until the keys exist: without them the billing page
 * says plans are free during early access instead of showing buttons that
 * would fail at Stripe.
 */
export function isBillingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

/** The API version is the one the installed SDK is typed against. */
export function getStripe() {
  client ??= new Stripe(requireServerEnv("STRIPE_SECRET_KEY"), {
    appInfo: { name: "glowa" },
  });
  return client;
}
