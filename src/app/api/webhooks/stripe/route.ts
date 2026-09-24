import type Stripe from "stripe";

import { syncAccountStatus } from "@/lib/payments/connect";
import { releaseExpiredSession, settleCheckoutSession } from "@/lib/payments/deposits";
import { getStripe } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe → GLOWA. Registered as a Connect endpoint, so it receives events that
 * happen on the salons' own accounts; `event.account` says whose.
 *
 * The signature is the whole authorization, and it is checked against the
 * raw body before anything is parsed. A handler error returns 500 so Stripe
 * retries; everything the handlers call is idempotent, so a retry - or the
 * same event delivered twice, which Stripe is allowed to do - changes nothing
 * the first delivery did not.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "missing_signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    await handle(event);
  } catch (cause) {
    console.error("stripe webhook failed", event.type, event.id, cause);
    return Response.json({ error: "handler_failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (!event.account) return;
      await settleCheckoutSession(event.data.object, event.account);
      return;
    }
    case "checkout.session.expired": {
      if (!event.account) return;
      await releaseExpiredSession(event.data.object, event.account);
      return;
    }
    case "account.updated": {
      await syncAccountStatus(event.data.object.id);
      return;
    }
    default:
      return;
  }
}
