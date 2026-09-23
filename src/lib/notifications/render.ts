import "server-only";

import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { pickLocalized } from "@/lib/localized";

import type { NotificationEvent } from "./types";

/**
 * Everything a message can talk about, resolved from the database at send
 * time. Nothing here is stored on the outbox row: a name corrected after
 * booking should reach the customer corrected.
 */
export type NotificationContext = {
  locale: Locale;
  event: NotificationEvent;
  businessName: string;
  businessSlug: string;
  businessTimezone: string;
  businessPhone: string | null;
  googleReviewUrl: string | null;
  serviceName: unknown;
  staffName: string | null;
  customerName: string | null;
  startsAt: string;
  locationName: string | null;
  locationAddress: string | null;
  appointmentId: string;
};

export type RenderedMessage = { subject: string; text: string; html: string };

/**
 * A campaign message. Unlike an appointment notification the copy is the
 * business's own, so nothing here is translated - it is rendered in whichever
 * language the business wrote for this recipient's locale.
 */
export type CampaignContext = {
  locale: Locale;
  businessName: string;
  businessSlug: string;
  subject: string;
  body: string;
  /** Per-recipient, opaque, and required: marketing without a way out is spam. */
  unsubscribeUrl: string;
};

export async function renderCampaign(
  context: CampaignContext,
): Promise<RenderedMessage> {
  const t = await getTranslations({
    locale: context.locale,
    namespace: "notifications",
  });

  const base = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${context.locale}`;
  const primary = {
    label: t("action.viewSalon"),
    href: `${base}/business/${context.businessSlug}`,
  };

  const text = [
    context.body,
    "",
    `${primary.label}: ${primary.href}`,
    "",
    t("footer.signature", { business: context.businessName }),
    `${t("footer.unsubscribe")}: ${context.unsubscribeUrl}`,
  ].join("\n");

  const html = renderHtml({
    heading: context.subject,
    body: context.body,
    details: [],
    primary,
    unsubscribe: {
      label: t("footer.unsubscribe"),
      href: context.unsubscribeUrl,
    },
  });

  return { subject: context.subject, text, html };
}

export async function renderNotification(
  context: NotificationContext,
): Promise<RenderedMessage> {
  const t = await getTranslations({
    locale: context.locale,
    namespace: "notifications",
  });

  const when = formatWhen(
    context.startsAt,
    context.locale,
    context.businessTimezone,
  );
  const service = pickLocalized(context.serviceName, context.locale, "");
  const values = {
    business: context.businessName,
    service,
    when,
    name: context.customerName ?? "",
    staff: context.staffName ?? "",
  };

  const subject = t(`${context.event}.subject`, values);
  const heading = t(`${context.event}.heading`, values);
  const body = t(`${context.event}.body`, values);

  const primary = primaryAction(context, t);
  const details = detailLines(context, service, when, t);

  const text = [
    heading,
    "",
    body,
    "",
    ...details.map((line) => `${line.label}: ${line.value}`),
    "",
    primary ? `${primary.label}: ${primary.href}` : "",
    "",
    t("footer.signature", { business: context.businessName }),
    t("footer.sentBy"),
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim();

  return { subject, text, html: renderHtml({ heading, body, details, primary }) };
}

type DetailLine = { label: string; value: string };
type Action = { label: string; href: string } | null;

function primaryAction(
  context: NotificationContext,
  t: (key: string, values?: Record<string, string>) => string,
): Action {
  const base = `${publicEnv.NEXT_PUBLIC_SITE_URL}/${context.locale}`;

  if (context.event === "review_request") {
    // Google is linked, never scraped: GLOWA sends the customer to the
    // business's own public destination and claims nothing about what
    // happens there.
    const href =
      context.googleReviewUrl ??
      `${base}/review/${context.appointmentId}`;
    return { label: t("action.leaveReview"), href };
  }

  if (context.event === "waitlist_offer") {
    // Straight into booking: the whole value of the message is being first.
    return {
      label: t("action.bookSlot"),
      href: `${base}/business/${context.businessSlug}/book`,
    };
  }

  if (context.event === "cancellation") {
    return {
      label: t("action.bookAgain"),
      href: `${base}/business/${context.businessSlug}`,
    };
  }

  return { label: t("action.manageBooking"), href: `${base}/bookings` };
}

function detailLines(
  context: NotificationContext,
  service: string,
  when: string,
  t: (key: string, values?: Record<string, string>) => string,
): DetailLine[] {
  const lines: DetailLine[] = [];

  if (service) lines.push({ label: t("label.service"), value: service });

  // A cancelled or completed appointment's time is history, not an instruction.
  if (context.event !== "review_request") {
    lines.push({ label: t("label.when"), value: when });
  }

  if (context.staffName) {
    lines.push({ label: t("label.staff"), value: context.staffName });
  }

  const place = [context.locationName, context.locationAddress]
    .filter(Boolean)
    .join(", ");
  if (place) lines.push({ label: t("label.where"), value: place });

  if (context.businessPhone) {
    lines.push({ label: t("label.phone"), value: context.businessPhone });
  }

  return lines;
}

function formatWhen(iso: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

/**
 * A single-column table layout with inline styles, because that is the only
 * thing every mail client agrees on. Colours are the light-mode brand tokens
 * written out literally: CSS variables do not survive an email client.
 */
function renderHtml(input: {
  heading: string;
  body: string;
  details: DetailLine[];
  primary: Action;
  unsubscribe?: { label: string; href: string };
}) {
  const rows = input.details
    .map(
      (line) => `
        <tr>
          <td style="padding:6px 0;color:#6b625b;font-size:14px;width:38%;">${escapeHtml(line.label)}</td>
          <td style="padding:6px 0;color:#0f1212;font-size:14px;font-weight:600;">${escapeHtml(line.value)}</td>
        </tr>`,
    )
    .join("");

  const button = input.primary
    ? `<a href="${escapeHtml(input.primary.href)}" style="display:inline-block;background:#d96c61;color:#fffaf8;text-decoration:none;padding:12px 22px;border-radius:14px;font-size:15px;font-weight:600;">${escapeHtml(input.primary.label)}</a>`
    : "";

  // Only marketing carries it, and when it does it is a plain visible link,
  // not a grey one-pixel afterthought.
  const footer = input.unsubscribe
    ? `<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #ddd5ce;font-size:12px;color:#6b625b;"><a href="${escapeHtml(input.unsubscribe.href)}" style="color:#6b625b;">${escapeHtml(input.unsubscribe.label)}</a></p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #ddd5ce;border-radius:20px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#d96c61;font-weight:700;">GLOWA</p>
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f1212;">${escapeHtml(input.heading)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a2e2a;white-space:pre-line;">${escapeHtml(input.body)}</p>
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ddd5ce;border-bottom:1px solid #ddd5ce;margin-bottom:24px;">${rows}</table>` : ""}
          ${button}
          ${footer}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
