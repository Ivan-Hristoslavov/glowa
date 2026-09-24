import "server-only";

import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";

import { publicEnv } from "@/lib/env";
import { pickLocalized } from "@/lib/localized";

import { resolveChannel } from "./channels";
import {
  renderCampaign,
  renderNotification,
  type NotificationContext,
} from "./render";
import type { NotificationDelivery } from "./types";

export type WorkerReport = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
};

const APPOINTMENT_SELECT = `
  id,
  starts_at,
  ends_at,
  status,
  price_cents,
  currency,
  customer_name,
  customer_email,
  customer_phone,
  service_name_snapshot,
  businesses!appointments_business_id_fkey (
    name, slug, timezone, phone, google_review_url, logo_url, cover_image_url
  ),
  staff_profiles ( display_name ),
  locations ( name, address_line1, city )
` as const;

const CAMPAIGN_SELECT = `
  id, template,
  businesses!marketing_campaigns_business_id_fkey ( name, slug, logo_url, cover_image_url )
` as const;

const CLIENT_SELECT = `id, full_name, email, phone, unsubscribe_token` as const;

/**
 * Drains the outbox once.
 *
 * The claim is atomic in Postgres (`for update skip locked`), so this can run
 * on several instances at the same time without two of them sending the same
 * message. Everything after the claim is per-row and independent: one bad
 * address does not hold up the batch.
 */
export async function runNotificationWorker(
  limit = 25,
): Promise<WorkerReport> {
  const supabase = createAdminClient();
  const report: WorkerReport = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

  const { data: claimed, error } = await supabase.rpc(
    "claim_notification_deliveries",
    { p_limit: limit },
  );
  if (error) throw new Error(`claim failed: ${error.message}`);

  const deliveries = (claimed ?? []) as NotificationDelivery[];
  report.claimed = deliveries.length;
  if (deliveries.length === 0) return report;

  const appointmentIds = [
    ...new Set(
      deliveries
        .map((delivery) => delivery.appointment_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const campaignIds = uniqueIds(deliveries.map((d) => d.campaign_id));
  const clientIds = uniqueIds(deliveries.map((d) => d.business_client_id));

  // Three lookups for the whole batch rather than three per message.
  const [appointments, campaigns, clients] = await Promise.all([
    appointmentIds.length
      ? supabase.from("appointments").select(APPOINTMENT_SELECT).in("id", appointmentIds)
      : { data: [] as unknown[] },
    campaignIds.length
      ? supabase.from("marketing_campaigns").select(CAMPAIGN_SELECT).in("id", campaignIds)
      : { data: [] as unknown[] },
    clientIds.length
      ? supabase.from("business_clients").select(CLIENT_SELECT).in("id", clientIds)
      : { data: [] as unknown[] },
  ]);

  const context: BatchContext = {
    appointments: indexById(appointments.data),
    campaigns: indexById(campaigns.data),
    clients: indexById(clients.data),
  };

  for (const delivery of deliveries) {
    const outcome = await deliverOne(delivery, context);
    report[outcome.bucket] += 1;

    await supabase
      .from("notification_deliveries")
      .update(outcome.patch)
      .eq("id", delivery.id);
  }

  // A campaign is "sent" when nothing is left in flight, not when the rows
  // were queued. Storing it any earlier would be a claim we cannot back up.
  for (const campaignId of campaignIds) {
    await supabase.rpc("finalize_campaign", { p_campaign_id: campaignId });
  }

  return report;
}

function uniqueIds(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function indexById(rows: unknown) {
  const list = Array.isArray(rows) ? rows : [];
  return new Map(
    list
      .filter((row): row is { id: string } => Boolean((row as { id?: string })?.id))
      .map((row) => [row.id, row as unknown]),
  );
}

type BatchContext = {
  appointments: Map<string, unknown>;
  campaigns: Map<string, unknown>;
  clients: Map<string, unknown>;
};

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  service_name_snapshot: unknown;
  businesses: {
    name: string;
    slug: string;
    timezone: string;
    phone: string | null;
    google_review_url: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
  } | null;
  staff_profiles: { display_name: string } | null;
  locations: { name: string; address_line1: string | null; city: string | null } | null;
};

type DeliveryOutcome = {
  bucket: "sent" | "failed" | "skipped";
  patch: Partial<NotificationDelivery>;
};

type CampaignRow = {
  id: string;
  template: unknown;
  businesses: {
    name: string;
    slug: string;
    logo_url: string | null;
    cover_image_url: string | null;
  } | null;
};

type ClientRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  unsubscribe_token: string;
};

async function deliverOne(
  delivery: NotificationDelivery,
  batch: BatchContext,
): Promise<DeliveryOutcome> {
  const adapter = resolveChannel(delivery.channel);
  if (!adapter) {
    // No provider for this channel in this deployment. Put it back rather
    // than burning an attempt on something only a deploy can fix.
    return {
      bucket: "skipped",
      patch: {
        status: "queued",
        attempts: Math.max(0, delivery.attempts - 1),
        error: `no_adapter_for_${delivery.channel}`,
      },
    };
  }

  if (delivery.campaign_id) {
    return deliverCampaign(delivery, batch, adapter);
  }

  const appointment = delivery.appointment_id
    ? (batch.appointments.get(delivery.appointment_id) as AppointmentRow | undefined)
    : undefined;

  if (!appointment || !appointment.businesses) {
    return {
      bucket: "skipped",
      patch: { status: "skipped", error: "appointment_missing" },
    };
  }

  if (!appointment.customer_email) {
    return {
      bucket: "skipped",
      patch: { status: "skipped", error: "no_contact" },
    };
  }

  const context: NotificationContext = {
    locale: asLocale(delivery.locale),
    event: delivery.event_type,
    businessName: appointment.businesses.name,
    businessSlug: appointment.businesses.slug,
    businessTimezone: appointment.businesses.timezone,
    businessPhone: appointment.businesses.phone,
    googleReviewUrl: appointment.businesses.google_review_url,
    serviceName: appointment.service_name_snapshot,
    staffName: appointment.staff_profiles?.display_name ?? null,
    customerName: appointment.customer_name,
    startsAt: appointment.starts_at,
    locationName: appointment.locations?.name ?? null,
    locationAddress:
      [appointment.locations?.address_line1, appointment.locations?.city]
        .filter(Boolean)
        .join(", ") || null,
    appointmentId: appointment.id,
    endsAt: appointment.ends_at,
    priceCents: appointment.price_cents,
    currency: appointment.currency,
    businessLogoUrl: appointment.businesses.logo_url,
    businessCoverUrl: appointment.businesses.cover_image_url,
  };

  const rendered = await renderNotification(context);

  const result = await adapter.send({
    to: {
      name: appointment.customer_name,
      email: appointment.customer_email,
      phone: appointment.customer_phone,
    },
    locale: context.locale,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    idempotencyKey: delivery.idempotency_key,
    profileId: delivery.profile_id,
    url: `/${context.locale}/bookings`,
  });

  if (result.ok) {
    return {
      bucket: "sent",
      patch: {
        status: "sent",
        sent_at: new Date().toISOString(),
        provider: adapter.provider,
        provider_message_id: result.providerMessageId,
        error: null,
      },
    };
  }

  // A permanent rejection is settled now; a transient one goes back in the
  // queue and the attempt counter decides when to stop.
  const exhausted = delivery.attempts >= 5;
  return {
    bucket: "failed",
    patch: {
      status: !result.retryable || exhausted ? "failed" : "queued",
      provider: adapter.provider,
      error: result.error.slice(0, 500),
    },
  };
}

/**
 * A campaign message. The copy belongs to the business, so nothing here is
 * translated - `pickLocalized` picks the language they wrote for this
 * recipient and falls back rather than sending an empty email.
 */
async function deliverCampaign(
  delivery: NotificationDelivery,
  batch: BatchContext,
  adapter: NonNullable<ReturnType<typeof resolveChannel>>,
): Promise<DeliveryOutcome> {
  const campaign = delivery.campaign_id
    ? (batch.campaigns.get(delivery.campaign_id) as CampaignRow | undefined)
    : undefined;
  const client = delivery.business_client_id
    ? (batch.clients.get(delivery.business_client_id) as ClientRow | undefined)
    : undefined;

  if (!campaign || !campaign.businesses || !client) {
    return {
      bucket: "skipped",
      patch: { status: "skipped", error: "campaign_missing" },
    };
  }

  if (!client.email) {
    return { bucket: "skipped", patch: { status: "skipped", error: "no_contact" } };
  }

  const locale = asLocale(delivery.locale);
  const template =
    typeof campaign.template === "object" && campaign.template !== null
      ? (campaign.template as Record<string, unknown>)
      : {};

  const subject = pickLocalized(template.subject, locale, "");
  const body = pickLocalized(template.body, locale, "");

  // An empty campaign is a bug upstream, not something to mail out blank.
  if (!subject || !body) {
    return {
      bucket: "skipped",
      patch: { status: "skipped", error: "empty_template" },
    };
  }

  const rendered = await renderCampaign({
    locale,
    businessName: campaign.businesses.name,
    businessSlug: campaign.businesses.slug,
    businessLogoUrl: campaign.businesses.logo_url,
    businessCoverUrl: campaign.businesses.cover_image_url,
    subject,
    body,
    unsubscribeUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/${locale}/unsubscribe/${client.unsubscribe_token}`,
  });

  const result = await adapter.send({
    to: { name: client.full_name, email: client.email, phone: client.phone },
    locale,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    idempotencyKey: delivery.idempotency_key,
    profileId: delivery.profile_id,
    url: `/${locale}/business/${campaign.businesses.slug}`,
  });

  if (result.ok) {
    return {
      bucket: "sent",
      patch: {
        status: "sent",
        sent_at: new Date().toISOString(),
        provider: adapter.provider,
        provider_message_id: result.providerMessageId,
        error: null,
      },
    };
  }

  const exhausted = delivery.attempts >= 5;
  return {
    bucket: "failed",
    patch: {
      status: !result.retryable || exhausted ? "failed" : "queued",
      provider: adapter.provider,
      error: result.error.slice(0, 500),
    },
  };
}

function asLocale(value: string): Locale {
  return (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}
