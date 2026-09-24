import "server-only";

import type Stripe from "stripe";

import type { Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import { createAdminClient } from "@/lib/supabase/admin";

import { getStripe } from "./stripe";

/**
 * Stripe refuses a Checkout Session that expires sooner than 30 minutes after
 * it is created. The hold on the slot is 32 minutes, so the first session
 * always fits; a retry after most of the hold has gone cannot open a new one.
 */
const MIN_SESSION_SECONDS = 30 * 60 + 15;

export type CheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code: "not_configured" | "not_awaiting" | "expired" | "provider_error";
    };

const APPOINTMENT_SELECT = `
  id, business_id, customer_profile_id, customer_email, starts_at, status,
  deposit_status, deposit_cents, currency, payment_due_at, service_name_snapshot,
  businesses!appointments_business_id_fkey ( name, timezone )
` as const;

async function loadAccount(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
) {
  const { data } = await admin
    .from("business_payment_accounts")
    .select("account_id, charges_enabled")
    .eq("business_id", businessId)
    .maybeSingle();
  return data;
}

/**
 * Opens (or re-opens) the Checkout page for an appointment's deposit.
 *
 * The caller has already established that the signed-in customer owns the
 * appointment - `book_appointment` just returned it to them, or an RLS read
 * did. Everything after that runs with the service role, because a customer
 * may not write payment records and must not be able to.
 */
export async function openDepositCheckout(
  appointmentId: string,
  locale: Locale,
): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, code: "not_configured" };

  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment || appointment.deposit_status !== "awaiting") {
    return { ok: false, code: "not_awaiting" };
  }

  const account = await loadAccount(admin, appointment.business_id);
  if (!account?.charges_enabled) return { ok: false, code: "not_configured" };

  // A session is already open for this hold: send the customer back to it
  // rather than creating a second one they could also pay.
  const { data: pending } = await admin
    .from("payment_records")
    .select("provider_reference")
    .eq("appointment_id", appointmentId)
    .eq("kind", "deposit")
    .eq("status", "pending")
    .not("provider_reference", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending?.provider_reference) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        pending.provider_reference,
        {},
        { stripeAccount: account.account_id },
      );
      if (existing.status === "open" && existing.url) {
        return { ok: true, url: existing.url };
      }
      if (existing.status === "complete") {
        await settleCheckoutSession(existing, account.account_id);
        return { ok: false, code: "not_awaiting" };
      }
    } catch (cause) {
      console.error("deposit: could not retrieve checkout session", cause);
    }
  }

  const dueAt = appointment.payment_due_at
    ? new Date(appointment.payment_due_at).getTime()
    : 0;
  const expiresAt = Math.floor(dueAt / 1000);
  if (expiresAt - Math.floor(Date.now() / 1000) < MIN_SESSION_SECONDS) {
    return { ok: false, code: "expired" };
  }

  const business = appointment.businesses;
  const serviceName =
    pickLocalized(appointment.service_name_snapshot, locale) || business?.name || "";
  const when = formatDateTime(appointment.starts_at, {
    timeZone: business?.timezone ?? "Europe/Sofia",
    locale,
  });
  const base = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${locale}/bookings/${appointmentId}`;
  const metadata = { appointment_id: appointmentId, business_id: appointment.business_id };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: appointment.currency.toLowerCase(),
              unit_amount: appointment.deposit_cents,
              product_data: {
                name: serviceName,
                description: `${business?.name ?? ""} · ${when}`,
              },
            },
          },
        ],
        customer_email: appointment.customer_email ?? undefined,
        client_reference_id: appointmentId,
        metadata,
        payment_intent_data: { metadata, description: `${business?.name ?? ""} · ${serviceName}` },
        expires_at: expiresAt,
        locale,
        success_url: `${base}?deposit=paid&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}?deposit=cancelled`,
      },
      {
        stripeAccount: account.account_id,
        idempotencyKey: `deposit-checkout:${appointmentId}:${expiresAt}`,
      },
    );
  } catch (cause) {
    console.error("deposit: checkout session could not be created", cause);
    return { ok: false, code: "provider_error" };
  }

  if (!session.url) return { ok: false, code: "provider_error" };

  await admin.from("payment_records").upsert(
    {
      business_id: appointment.business_id,
      appointment_id: appointmentId,
      profile_id: appointment.customer_profile_id,
      kind: "deposit",
      status: "pending",
      amount_cents: appointment.deposit_cents,
      currency: appointment.currency,
      provider: "stripe",
      provider_reference: session.id,
    },
    { onConflict: "provider,provider_reference", ignoreDuplicates: true },
  );

  return { ok: true, url: session.url };
}

export type SettleOutcome =
  | "paid"
  | "already"
  | "refunding"
  | "duplicate"
  | "missing"
  | "unpaid"
  | "rejected";

/**
 * Records a completed Checkout Session. Called by the webhook and by the page
 * the customer lands on, in either order; `settle_deposit` is idempotent.
 *
 * The session is checked against the appointment before anything is written.
 * Every salon on the platform can create Checkout Sessions on its own account
 * with whatever metadata it likes, so "the metadata names appointment X" is a
 * claim, not a fact: the money has to have landed on *that* salon's account,
 * in that currency, for at least the deposit.
 */
export async function settleCheckoutSession(
  session: Stripe.Checkout.Session,
  accountId: string,
): Promise<SettleOutcome> {
  if (session.payment_status !== "paid") return "unpaid";

  const appointmentId = session.metadata?.appointment_id ?? session.client_reference_id;
  if (!appointmentId) return "missing";

  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("id, business_id, deposit_cents, currency")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment) return "missing";

  const account = await loadAccount(admin, appointment.business_id);
  if (
    !account ||
    account.account_id !== accountId ||
    (session.currency ?? "").toUpperCase() !== appointment.currency.toUpperCase() ||
    (session.amount_total ?? 0) < appointment.deposit_cents
  ) {
    console.error("deposit: session does not match its appointment", {
      session: session.id,
      appointment: appointmentId,
    });
    return "rejected";
  }

  const paymentReference =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { data, error } = await admin.rpc("settle_deposit", {
    p_appointment_id: appointmentId,
    p_session_id: session.id,
    p_payment_reference: paymentReference ?? "",
    p_amount_cents: session.amount_total ?? appointment.deposit_cents,
    p_currency: session.currency ?? appointment.currency,
  });
  if (error) throw new Error(`settle_deposit failed: ${error.message}`);

  return (data as SettleOutcome) ?? "missing";
}

/**
 * The customer's return from Checkout. Settling here as well as in the
 * webhook means the booking page is right the moment they land on it, even if
 * the webhook is a few seconds behind - or not configured at all locally.
 */
export async function reconcileReturnedSession(
  appointmentId: string,
  sessionId: string,
): Promise<SettleOutcome | null> {
  const stripe = getStripe();
  if (!stripe || !sessionId.startsWith("cs_")) return null;

  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("business_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment) return null;

  const account = await loadAccount(admin, appointment.business_id);
  if (!account) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount: account.account_id },
    );
    if (
      (session.metadata?.appointment_id ?? session.client_reference_id) !==
      appointmentId
    ) {
      return "rejected";
    }
    return await settleCheckoutSession(session, account.account_id);
  } catch (cause) {
    console.error("deposit: could not reconcile returned session", cause);
    return null;
  }
}

/**
 * Stripe expired a session. Like settling, the metadata is only a claim: the
 * session has to belong to the account of the salon that owns the booking,
 * or any salon on the platform could expire sessions naming other salons'
 * appointments and cancel their clients' holds.
 */
export async function releaseExpiredSession(
  session: Stripe.Checkout.Session,
  accountId: string,
) {
  const appointmentId = session.metadata?.appointment_id ?? session.client_reference_id;
  if (!appointmentId) return;

  const admin = createAdminClient();
  const { data: appointment } = await admin
    .from("appointments")
    .select("business_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appointment) return;

  const account = await loadAccount(admin, appointment.business_id);
  if (account?.account_id !== accountId) return;

  await releaseUnpaidDeposit(appointmentId, "deposit_unpaid");
}

/**
 * Frees a slot whose deposit is not coming. Only ever touches a hold that is
 * still awaiting payment, so calling it for a booking paid another way is a
 * no-op.
 */
export async function releaseUnpaidDeposit(appointmentId: string, reason: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("release_unpaid_deposit", {
    p_appointment_id: appointmentId,
    p_reason: reason,
  });
  if (error) console.error("deposit: release failed", error);
}

export type PaymentsReport = { expired: number; refunded: number; refundFailed: number };

/**
 * The payment half of the scheduled work: release holds nobody paid for, and
 * issue the refunds that cancellations queued.
 *
 * A refund carries an idempotency key derived from its own row, so two
 * overlapping runs - or a retry after a response that never arrived - produce
 * one refund at Stripe, not two.
 */
export async function runPaymentsMaintenance(limit = 20): Promise<PaymentsReport> {
  const admin = createAdminClient();
  const report: PaymentsReport = { expired: 0, refunded: 0, refundFailed: 0 };

  const { data: expired, error: expireError } = await admin.rpc("expire_unpaid_deposits");
  if (expireError) throw new Error(`expire_unpaid_deposits failed: ${expireError.message}`);
  report.expired = expired ?? 0;

  const stripe = getStripe();
  if (!stripe) return report;

  const { data: refunds, error } = await admin.rpc("pending_deposit_refunds", {
    p_limit: limit,
  });
  if (error) throw new Error(`pending_deposit_refunds failed: ${error.message}`);

  for (const row of refunds ?? []) {
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: row.payment_reference,
          reason: "requested_by_customer",
          metadata: { appointment_id: row.appointment_id ?? "", refund_record_id: row.refund_id },
        },
        { stripeAccount: row.account_id, idempotencyKey: `deposit-refund:${row.refund_id}` },
      );
      const succeeded = refund.status !== "failed" && refund.status !== "canceled";
      await admin.rpc("complete_deposit_refund", {
        p_refund_id: row.refund_id,
        p_provider_reference: refund.id,
        p_succeeded: succeeded,
        p_error: succeeded ? undefined : (refund.failure_reason ?? refund.status ?? "failed"),
      });
      if (succeeded) report.refunded += 1;
      else report.refundFailed += 1;
    } catch (cause) {
      const stripeError = cause as { type?: string; code?: string; message?: string };
      // Already refunded at Stripe (by the salon, in its own dashboard): the
      // outcome we wanted has happened, so record it rather than retrying.
      if (stripeError.code === "charge_already_refunded") {
        await admin.rpc("complete_deposit_refund", {
          p_refund_id: row.refund_id,
          p_provider_reference: "",
          p_succeeded: true,
        });
        report.refunded += 1;
        continue;
      }
      // A request Stripe understood and refused will be refused again; stop
      // and show it to the salon. Anything else (network, rate limit, 5xx)
      // stays pending and is retried on the next run.
      if (stripeError.type === "StripeInvalidRequestError") {
        await admin.rpc("complete_deposit_refund", {
          p_refund_id: row.refund_id,
          p_provider_reference: "",
          p_succeeded: false,
          p_error: stripeError.message ?? "refund refused",
        });
        report.refundFailed += 1;
      } else {
        console.error("deposit: refund will be retried", cause);
      }
    }
  }

  return report;
}
