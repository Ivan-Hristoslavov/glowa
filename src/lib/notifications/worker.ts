import "server-only";

import type { Locale } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";

import { resolveChannel } from "./channels";
import { renderNotification, type NotificationContext } from "./render";
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
  status,
  customer_name,
  customer_email,
  customer_phone,
  service_name_snapshot,
  businesses!appointments_business_id_fkey (
    name, slug, timezone, phone, google_review_url
  ),
  staff_profiles ( display_name ),
  locations ( name, address_line1, city )
` as const;

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

  const { data: appointments } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .in("id", appointmentIds);

  const byId = new Map(
    (appointments ?? []).map((appointment) => [appointment.id, appointment]),
  );

  for (const delivery of deliveries) {
    const outcome = await deliverOne(delivery, byId);
    report[outcome.bucket] += 1;

    await supabase
      .from("notification_deliveries")
      .update(outcome.patch)
      .eq("id", delivery.id);
  }

  return report;
}

type AppointmentRow = {
  id: string;
  starts_at: string;
  status: string;
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
  } | null;
  staff_profiles: { display_name: string } | null;
  locations: { name: string; address_line1: string | null; city: string | null } | null;
};

type DeliveryOutcome = {
  bucket: "sent" | "failed" | "skipped";
  patch: Partial<NotificationDelivery>;
};

async function deliverOne(
  delivery: NotificationDelivery,
  appointments: Map<string, unknown>,
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

  const appointment = delivery.appointment_id
    ? (appointments.get(delivery.appointment_id) as AppointmentRow | undefined)
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

function asLocale(value: string): Locale {
  return (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}
