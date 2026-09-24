import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { parsePriceLookupKey, SUBSCRIPTION_STATUSES } from "@/lib/billing/plans";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { requireServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const HANDLED = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/**
 * Stripe → `business_subscriptions`.
 *
 * A platform endpoint, separate from the Connect endpoint for deposits
 * (`/api/webhooks/stripe`): subscription events happen on GLOWA's own account,
 * which a Connect endpoint never receives. Its own signing secret is
 * `STRIPE_BILLING_WEBHOOK_SECRET`.
 *
 * The signature is verified against the raw body before anything is read.
 * Only subscription events are handled: each carries the whole subscription,
 * including the `business_id` put in its metadata at checkout, so there is no
 * need to call Stripe back, and `apply_stripe_subscription` drops any event
 * older than the one already applied - Stripe does not promise order.
 *
 * Answers 200 to events it ignores, so Stripe stops retrying them, and 500
 * when the write fails, so Stripe tries again.
 */
export async function POST(request: Request) {
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature ?? "",
      requireServerEnv("STRIPE_BILLING_WEBHOOK_SECRET"),
    );
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true });

  const subscription = event.data.object as Stripe.Subscription;
  const businessId = subscription.metadata?.business_id;
  const item = subscription.items.data[0];
  const price = parsePriceLookupKey(item?.price.lookup_key);
  const status = (SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status)
    ? subscription.status
    : null;

  // Not one of ours (another product in the same Stripe account), or no salon.
  if (!businessId || !price || !status) return NextResponse.json({ received: true });

  const periodEnd = item?.current_period_end;
  const { error } = await createAdminClient().rpc("apply_stripe_subscription", {
    p_business_id: businessId,
    p_plan: price.plan,
    p_interval: price.interval,
    p_status: status,
    p_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    p_subscription_id: subscription.id,
    p_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_event_at: new Date(event.created * 1000).toISOString(),
  });

  if (error) {
    // A salon deleted since checkout: nothing to update, stop the retries.
    if (error.code === "23503") return NextResponse.json({ received: true });
    console.error("[stripe] could not apply subscription", event.id, error);
    return NextResponse.json({ error: "apply_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
