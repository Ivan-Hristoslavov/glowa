import "server-only";

import type { Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

import { getStripe } from "./stripe";

/** Merchant category for "Barber and beauty shops". */
const BEAUTY_MCC = "7230";

const SUPPORTED_COUNTRIES = new Set(["BG", "RO"]);

export type OnboardingResult =
  | { ok: true; url: string }
  | { ok: false; code: "not_configured" | "missing_business" | "provider_error" };

/**
 * Creates the salon's Stripe account on first use and returns a one-time
 * onboarding link into it.
 *
 * The account is the equivalent of a Standard account: the salon gets the
 * full Stripe Dashboard, pays Stripe's fees itself, Stripe carries the
 * negative-balance risk and collects the identity requirements. GLOWA never
 * sees a bank account or an ID document. The caller must already have
 * checked that the signed-in user administers this business.
 */
export async function createOnboardingLink(
  businessId: string,
  locale: Locale,
): Promise<OnboardingResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, code: "not_configured" };

  const admin = createAdminClient();
  const { data: business } = await admin
    .from("businesses")
    .select("id, name, slug, email, locations ( country_code, is_primary )")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return { ok: false, code: "missing_business" };

  const { data: existing } = await admin
    .from("business_payment_accounts")
    .select("account_id")
    .eq("business_id", businessId)
    .maybeSingle();

  let accountId = existing?.account_id ?? null;

  try {
    if (!accountId) {
      const primary =
        business.locations.find((location) => location.is_primary) ??
        business.locations[0];
      const country = (primary?.country_code ?? "BG").toUpperCase();

      const account = await stripe.accounts.create(
        {
          country: SUPPORTED_COUNTRIES.has(country) ? country : "BG",
          email: business.email ?? undefined,
          business_profile: {
            name: business.name,
            mcc: BEAUTY_MCC,
            url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/${locale}/business/${business.slug}`,
          },
          controller: {
            stripe_dashboard: { type: "full" },
            fees: { payer: "account" },
            losses: { payments: "stripe" },
            requirement_collection: "stripe",
          },
          metadata: { business_id: businessId },
        },
        { idempotencyKey: `connect-account:${businessId}` },
      );

      const { error } = await admin.rpc("link_payment_account", {
        p_business_id: businessId,
        p_account_id: account.id,
      });
      if (error) throw new Error(`link_payment_account failed: ${error.message}`);
      accountId = account.id;
    }

    const base = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${locale}/dashboard/payments`;
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}?stripe=refresh`,
      return_url: `${base}?stripe=return`,
    });
    return { ok: true, url: link.url };
  } catch (cause) {
    console.error("connect: onboarding link failed", cause);
    return { ok: false, code: "provider_error" };
  }
}

/**
 * Pulls the account's state from Stripe and mirrors it. Used when the salon
 * returns from onboarding - so the page is right without waiting for the
 * `account.updated` webhook - and by that webhook itself.
 */
export async function syncAccountStatus(accountId: string) {
  const stripe = getStripe();
  if (!stripe) return null;

  const account = await stripe.accounts.retrieve(accountId);
  const admin = createAdminClient();
  const { error } = await admin.rpc("sync_payment_account", {
    p_account_id: account.id,
    p_charges_enabled: Boolean(account.charges_enabled),
    p_payouts_enabled: Boolean(account.payouts_enabled),
    p_details_submitted: Boolean(account.details_submitted),
  });
  if (error) throw new Error(`sync_payment_account failed: ${error.message}`);

  return {
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
  };
}
