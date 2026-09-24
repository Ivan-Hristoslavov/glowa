"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";
import { isLiveSubscription, priceLookupKey } from "@/lib/billing/plans";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { publicEnv } from "@/lib/env";

export type BillingResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code:
        | "invalid"
        | "unauthenticated"
        | "not_a_member"
        | "forbidden"
        | "not_configured"
        | "price_missing"
        | "no_subscription"
        | "generic";
    };

const checkoutSchema = z.object({
  businessId: z.uuid(),
  plan: z.enum(["solo", "studio", "salon"]),
  interval: z.enum(["month", "year"]),
});

function refusal(code: string) {
  return code === "unauthenticated" || code === "not_a_member" ? code : "forbidden";
}

function billingUrl(locale: string, status?: string) {
  const base = `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/${locale}/dashboard/billing`;
  return status ? `${base}?status=${status}` : base;
}

/**
 * Sends an owner or admin to Stripe Checkout for a plan. Stripe collects the
 * card, the billing address and, for companies, the VAT number; the webhook
 * records the result. A salon that already pays is sent to the customer
 * portal instead, which is where plans are changed without a second
 * subscription.
 */
export async function startCheckout(input: z.input<typeof checkoutSchema>): Promise<BillingResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  if (!isBillingConfigured()) return { ok: false, code: "not_configured" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return { ok: false, code: refusal(guard.code) };

  const { businessId, plan, interval } = parsed.data;
  const locale = await getLocale();

  const { data: current } = await guard.supabase
    .from("business_subscriptions")
    .select("status, stripe_customer_id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (current && isLiveSubscription(current.status)) {
    return openBillingPortal({ businessId });
  }

  try {
    const stripe = getStripe();
    const prices = await stripe.prices.list({
      lookup_keys: [priceLookupKey(plan, interval)],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) return { ok: false, code: "price_missing" };

    const { data: claims } = await guard.supabase.auth.getClaims();
    const email = typeof claims?.claims?.email === "string" ? claims.claims.email : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      ...(current?.stripe_customer_id
        ? {
            customer: current.stripe_customer_id,
            customer_update: { name: "auto", address: "auto" },
          }
        : { customer_email: email }),
      client_reference_id: businessId,
      // Carried on the subscription so every later webhook knows the salon.
      subscription_data: { metadata: { business_id: businessId } },
      metadata: { business_id: businessId },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      locale: locale === "bg" || locale === "ro" ? locale : "en",
      success_url: billingUrl(locale, "success"),
      cancel_url: billingUrl(locale, "cancelled"),
    });
    if (!session.url) return { ok: false, code: "generic" };
    return { ok: true, url: session.url };
  } catch (error) {
    console.error("[billing] checkout failed", error);
    return { ok: false, code: "generic" };
  }
}

const portalSchema = z.object({ businessId: z.uuid() });

/** Stripe's customer portal: card, invoices, plan changes, cancellation. */
export async function openBillingPortal(
  input: z.input<typeof portalSchema>,
): Promise<BillingResult> {
  const parsed = portalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  if (!isBillingConfigured()) return { ok: false, code: "not_configured" };

  const guard = await requireMembership(parsed.data.businessId, "admin");
  if (!guard.ok) return { ok: false, code: refusal(guard.code) };

  const { data: current } = await guard.supabase
    .from("business_subscriptions")
    .select("stripe_customer_id")
    .eq("business_id", parsed.data.businessId)
    .maybeSingle();
  if (!current) return { ok: false, code: "no_subscription" };

  try {
    const locale = await getLocale();
    const session = await getStripe().billingPortal.sessions.create({
      customer: current.stripe_customer_id,
      return_url: billingUrl(locale),
      locale: locale === "bg" || locale === "ro" ? locale : "en",
    });
    return { ok: true, url: session.url };
  } catch (error) {
    console.error("[billing] portal failed", error);
    return { ok: false, code: "generic" };
  }
}
