/**
 * Creates GLOWA's products and prices in a Stripe account, from the amounts
 * in src/lib/pricing.ts. Safe to run again: existing products are found by
 * metadata and prices by lookup key; a changed amount gets a new price that
 * takes over the lookup key (Stripe prices are immutable).
 *
 *   STRIPE_SECRET_KEY=sk_test_... node --experimental-strip-types scripts/stripe-setup.ts
 *
 * Use a test key first. Then, in the Stripe dashboard:
 *   - Developers -> Webhooks: endpoint https://<site>/api/stripe/webhook with
 *     the customer.subscription.* events; put its signing secret in
 *     STRIPE_WEBHOOK_SECRET.
 *   - Settings -> Billing -> Customer portal: allow updating the payment
 *     method, cancelling and switching between the GLOWA products.
 */
import Stripe from "stripe";

import { PLANS } from "../src/lib/pricing.ts";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY (a test key first).");
  process.exit(1);
}

const stripe = new Stripe(key);
const NAMES = { solo: "Glowa Solo", studio: "Glowa Studio", salon: "Glowa Salon" } as const;

for (const plan of PLANS) {
  // Unpublished or free plans have nothing to sell.
  if (plan.monthly === null || plan.annualMonthly === null || plan.monthly === 0) continue;

  const found = await stripe.products.search({ query: `metadata['glowa_plan']:'${plan.id}'` });
  const product =
    found.data[0] ??
    (await stripe.products.create({ name: NAMES[plan.id], metadata: { glowa_plan: plan.id } }));

  for (const interval of ["month", "year"] as const) {
    const lookupKey = `glowa_${plan.id}_${interval}`;
    const amount = interval === "month" ? plan.monthly : plan.annualMonthly * 12;
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (existing.data[0]?.unit_amount === amount) {
      console.log(`= ${lookupKey} ${amount / 100} ${plan.currency}`);
      continue;
    }
    await stripe.prices.create({
      product: product.id,
      currency: plan.currency.toLowerCase(),
      unit_amount: amount,
      recurring: { interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      // Prices on the pricing page are without VAT.
      tax_behavior: "exclusive",
    });
    console.log(`+ ${lookupKey} ${amount / 100} ${plan.currency}`);
  }
}
