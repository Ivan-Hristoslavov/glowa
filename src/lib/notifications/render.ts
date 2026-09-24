import "server-only";

import { getTranslations } from "next-intl/server";

import { localeHrefLang, type Locale } from "@/i18n/routing";
import { calendarProviders } from "@/lib/calendar";
import { publicEnv } from "@/lib/env";
import { formatPrice } from "@/lib/format";
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
  endsAt?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  /** Absolute URLs from the business-media bucket, when the salon has them. */
  businessLogoUrl?: string | null;
  businessCoverUrl?: string | null;
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
  businessLogoUrl?: string | null;
  businessCoverUrl?: string | null;
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
    locale: context.locale,
    preheader: context.body.slice(0, 140),
    brand: {
      name: context.businessName,
      logoUrl: absoluteImage(context.businessLogoUrl),
      coverUrl: absoluteImage(context.businessCoverUrl),
    },
    badge: null,
    heading: context.subject,
    body: context.body,
    ticket: null,
    details: [],
    primary,
    secondary: [],
    footerLines: [t("footer.signature", { business: context.businessName }), t("footer.sentBy")],
    unsubscribe: {
      label: t("footer.unsubscribe"),
      href: context.unsubscribeUrl,
    },
  });

  return { subject: context.subject, text, html };
}

/**
 * "Time for your next one": the salon inviting a client back when the service
 * they had is due again. The message is built around real free times - the
 * worker found them a moment ago with the same function the booking flow
 * uses - so one tap lands on the confirm step with that time chosen.
 */
export type RebookContext = {
  locale: Locale;
  businessName: string;
  businessTimezone: string;
  businessPhone: string | null;
  businessLogoUrl?: string | null;
  businessCoverUrl?: string | null;
  serviceName: unknown;
  staffName: string | null;
  customerName: string | null;
  weeks: number;
  slots: { startsAt: string; href: string }[];
  allTimesHref: string;
  /** The client's own opaque token; null only if the CRM row is missing. */
  unsubscribeUrl: string | null;
  locationName: string | null;
  locationAddress: string | null;
};

export async function renderRebookInvitation(
  context: RebookContext,
): Promise<RenderedMessage> {
  const t = await getTranslations({
    locale: context.locale,
    namespace: "notifications",
  });

  const service = pickLocalized(context.serviceName, context.locale, "");
  const values = {
    business: context.businessName,
    service,
    weeks: context.weeks,
    name: context.customerName ?? "",
    staff: context.staffName ?? "none",
  };

  const subject = t("rebook_nudge.subject", values);
  const heading = t("rebook_nudge.heading", values);
  const body = t(
    context.slots.length > 0 ? "rebook_nudge.body" : "rebook_nudge.bodyNoSlots",
    values,
  );
  const choices = context.slots.map((slot) => ({
    label: formatSlot(slot.startsAt, context.locale, context.businessTimezone),
    href: slot.href,
  }));
  const primary = { label: t("action.allTimes"), href: context.allTimesHref };
  const unsubscribe = context.unsubscribeUrl
    ? {
        label: t("footer.noInvitations", { business: context.businessName }),
        href: context.unsubscribeUrl,
      }
    : undefined;

  const text = [
    heading,
    "",
    body,
    "",
    ...choices.map((choice) => `• ${choice.label}: ${choice.href}`),
    choices.length ? "" : null,
    `${primary.label}: ${primary.href}`,
    "",
    t("footer.signature", { business: context.businessName }),
    t("footer.sentBy"),
    unsubscribe ? `${unsubscribe.label}: ${unsubscribe.href}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
    .trim();

  const html = renderHtml({
    locale: context.locale,
    preheader: body.slice(0, 140),
    brand: {
      name: context.businessName,
      logoUrl: absoluteImage(context.businessLogoUrl),
      coverUrl: absoluteImage(context.businessCoverUrl),
    },
    badge: { label: t("badge.rebook_nudge"), tone: "coral" },
    heading,
    body,
    ticket: null,
    choices,
    details: [],
    primary,
    secondary: context.businessPhone
      ? [
          {
            label: t("action.call"),
            href: `tel:${context.businessPhone.replace(/[^\d+]/g, "")}`,
          },
        ]
      : [],
    footerLines: [
      t("footer.signature", { business: context.businessName }),
      [context.locationName, context.locationAddress].filter(Boolean).join(" · "),
      t("footer.sentBy"),
    ].filter(Boolean),
    unsubscribe,
  });

  return { subject, text, html };
}

/** "Thu, 16 October · 18:00" in the salon's own time zone. */
function formatSlot(iso: string, locale: Locale, timeZone: string) {
  const lang = localeHrefLang[locale];
  const start = new Date(iso);
  const day = new Intl.DateTimeFormat(lang, {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(start);
  const time = new Intl.DateTimeFormat(lang, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(start);
  return `${day} · ${time}`;
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

  const showsTime = context.event !== "review_request" && context.event !== "cancellation";
  const html = renderHtml({
    locale: context.locale,
    preheader: body.slice(0, 140),
    brand: {
      name: context.businessName,
      logoUrl: absoluteImage(context.businessLogoUrl),
      coverUrl: absoluteImage(context.businessCoverUrl),
    },
    badge: { label: t(`badge.${context.event}`), tone: BADGE_TONE[context.event] ?? "coral" },
    heading,
    body,
    ticket: showsTime ? buildTicket(context, service) : null,
    // The ticket already says when, what and with whom.
    details: showsTime
      ? details.filter(
          (line) =>
            ![t("label.when"), t("label.service"), t("label.staff")].includes(line.label),
        )
      : details,
    primary,
    secondary: showsTime ? secondaryActions(context, service, t) : [],
    footerLines: [
      t("footer.signature", { business: context.businessName }),
      [context.locationName, context.locationAddress].filter(Boolean).join(" · "),
      t("footer.sentBy"),
    ].filter(Boolean),
  });

  return { subject, text, html };
}

const BADGE_TONE: Partial<Record<NotificationEvent, BadgeTone>> = {
  booking_confirmation: "green",
  reminder: "coral",
  reschedule: "coral",
  cancellation: "grey",
  review_request: "gold",
  waitlist_offer: "green",
};

type BadgeTone = "green" | "coral" | "grey" | "gold";

type Ticket = {
  day: string;
  month: string;
  weekday: string;
  time: string;
  title: string;
  subtitle: string;
};

/** The big date block: "24 / SEP / Thu" on the left, the time on the right. */
function buildTicket(context: NotificationContext, service: string): Ticket {
  const lang = localeHrefLang[context.locale];
  const zone = context.businessTimezone;
  const start = new Date(context.startsAt);
  // Parts of one full date rather than separate one-field formats: asked for
  // the month alone, Bulgarian formats it as a number ("09").
  const parts = new Intl.DateTimeFormat(lang, {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: zone,
  }).formatToParts(start);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  // Bulgarian has no short month name in CLDR (it prints "09"), so the ticket
  // spells the month out in full, small and letter-spaced, in every language.
  const month = new Intl.DateTimeFormat(lang, { month: "long", timeZone: zone }).format(start);
  const time = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", timeZone: zone });
  const range = context.endsAt
    ? `${time.format(start)} – ${time.format(new Date(context.endsAt))}`
    : time.format(start);
  const price =
    context.priceCents != null && context.currency
      ? formatPrice(context.priceCents, context.currency, context.locale)
      : null;

  return {
    day: part("day"),
    month: month.toUpperCase(),
    weekday: part("weekday"),
    time: range,
    title: service || context.businessName,
    subtitle: [context.staffName, price].filter(Boolean).join(" · "),
  };
}

/** Add to calendar, directions, call - the three things people do next. */
function secondaryActions(
  context: NotificationContext,
  service: string,
  t: (key: string, values?: Record<string, string>) => string,
): { label: string; href: string }[] {
  const actions: { label: string; href: string }[] = [];
  const endsAt =
    context.endsAt ?? new Date(new Date(context.startsAt).getTime() + 60 * 60_000).toISOString();
  const place = [context.locationName, context.locationAddress].filter(Boolean).join(", ");

  const calendarUrl = calendarProviders.google.buildAddUrl({
    uid: context.appointmentId,
    title: service ? `${service} · ${context.businessName}` : context.businessName,
    description: context.staffName,
    location: place || null,
    startsAt: context.startsAt,
    endsAt,
  });
  if (calendarUrl) actions.push({ label: t("action.addToCalendar"), href: calendarUrl });

  if (context.locationAddress) {
    actions.push({
      label: t("action.directions"),
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [context.businessName, context.locationAddress].join(", "),
      )}`,
    });
  }
  if (context.businessPhone) {
    actions.push({
      label: t("action.call"),
      href: `tel:${context.businessPhone.replace(/[^\d+]/g, "")}`,
    });
  }
  return actions;
}

/** Only absolute http(s) URLs reach an email; a relative path is useless there. */
function absoluteImage(url: string | null | undefined) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("/")) return `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${url}`;
  return null;
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
 * written out literally: CSS variables do not survive an email client, and
 * `color-scheme: light` stops clients that auto-darken from inverting the
 * coral into mud.
 *
 * Structure, top to bottom: hidden preheader (the preview line in the inbox),
 * the salon's logo and name, its cover photo when it has one, a status pill,
 * the heading and message, the appointment as a ticket (date block + time),
 * the remaining details, one primary button and a row of quiet secondary
 * links (calendar, directions, call), then the footer.
 */
const BADGE_COLOURS: Record<BadgeTone, { bg: string; fg: string }> = {
  green: { bg: "#e6f1e9", fg: "#35684a" },
  coral: { bg: "#fbe7e3", fg: "#b24d42" },
  grey: { bg: "#efebe7", fg: "#6b625b" },
  gold: { bg: "#f7eed9", fg: "#8a6420" },
};

function renderHtml(input: {
  locale: Locale;
  preheader: string;
  brand: { name: string; logoUrl: string | null; coverUrl: string | null };
  badge: { label: string; tone: BadgeTone } | null;
  heading: string;
  body: string;
  ticket: Ticket | null;
  /** Tappable options (free times), each its own full-width link. */
  choices?: { label: string; href: string }[];
  details: DetailLine[];
  primary: Action;
  secondary: { label: string; href: string }[];
  footerLines: string[];
  unsubscribe?: { label: string; href: string };
}) {
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const serif = "'Playfair Display',Georgia,'Times New Roman',serif";

  const logo = input.brand.logoUrl
    ? `<img src="${escapeHtml(input.brand.logoUrl)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:50%;object-fit:cover;border:0;" />`
    : `<div style="width:44px;height:44px;border-radius:50%;background:#fbe7e3;color:#d96c61;font-family:${serif};font-size:20px;line-height:44px;text-align:center;">${escapeHtml(input.brand.name.charAt(0))}</div>`;

  const cover = input.brand.coverUrl
    ? `<tr><td style="padding:0;"><img src="${escapeHtml(input.brand.coverUrl)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;max-height:240px;object-fit:cover;border:0;" /></td></tr>`
    : `<tr><td style="padding:0;height:6px;background:linear-gradient(90deg,#d96c61,#eac2bb,#a9b6a6);font-size:0;line-height:0;">&nbsp;</td></tr>`;

  const badge = input.badge
    ? `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${BADGE_COLOURS[input.badge.tone].bg};color:${BADGE_COLOURS[input.badge.tone].fg};font-size:12px;font-weight:700;letter-spacing:0.04em;">${escapeHtml(input.badge.label)}</span>`
    : "";

  const ticket = input.ticket
    ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #eadfd6;border-radius:18px;border-collapse:separate;overflow:hidden;">
            <tr>
              <td width="96" align="center" valign="middle" style="background:#d96c61;color:#ffffff;padding:16px 8px;border-radius:17px 0 0 17px;">
                <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(input.ticket.month)}</div>
                <div style="font-family:${serif};font-size:40px;line-height:1.05;font-weight:600;">${escapeHtml(input.ticket.day)}</div>
                <div style="font-size:12px;opacity:0.9;">${escapeHtml(input.ticket.weekday)}</div>
              </td>
              <td valign="middle" style="padding:16px 20px;background:#fffaf7;">
                <div style="font-size:22px;font-weight:700;color:#0f1212;letter-spacing:-0.01em;">${escapeHtml(input.ticket.time)}</div>
                <div style="margin-top:4px;font-size:15px;color:#0f1212;">${escapeHtml(input.ticket.title)}</div>
                ${input.ticket.subtitle ? `<div style="margin-top:2px;font-size:13px;color:#6b625b;">${escapeHtml(input.ticket.subtitle)}</div>` : ""}
              </td>
            </tr>
          </table>`
    : "";

  const choices = input.choices?.length
    ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">${input.choices
            .map(
              (choice) => `
            <tr>
              <td style="padding:0 0 10px;">
                <a href="${escapeHtml(choice.href)}" style="display:block;padding:14px 18px;border:1px solid #eadfd6;border-radius:14px;background:#fffaf7;color:#0f1212;text-decoration:none;font-size:15px;font-weight:600;"><span style="color:#d96c61;">&#9679;</span>&nbsp; ${escapeHtml(choice.label)} <span style="color:#d96c61;font-weight:700;">&rarr;</span></a>
              </td>
            </tr>`,
            )
            .join("")}
          </table>`
    : "";

  const rows = input.details
    .map(
      (line) => `
            <tr>
              <td style="padding:8px 0;color:#6b625b;font-size:13px;width:36%;border-top:1px solid #f0e8e1;">${escapeHtml(line.label)}</td>
              <td style="padding:8px 0;color:#0f1212;font-size:14px;font-weight:600;border-top:1px solid #f0e8e1;">${escapeHtml(line.value)}</td>
            </tr>`,
    )
    .join("");

  const button = input.primary
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 0;"><tr><td style="border-radius:14px;background:#d96c61;box-shadow:0 8px 20px -10px rgba(217,108,97,0.8);"><a href="${escapeHtml(input.primary.href)}" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${escapeHtml(input.primary.label)} &rarr;</a></td></tr></table>`
    : "";

  const secondary = input.secondary.length
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:2;">${input.secondary
        .map(
          (action) =>
            `<a href="${escapeHtml(action.href)}" style="display:inline-block;margin:0 8px 6px 0;padding:6px 12px;border:1px solid #eadfd6;border-radius:999px;color:#4a2e2a;text-decoration:none;background:#ffffff;">${escapeHtml(action.label)}</a>`,
        )
        .join("")}</p>`
    : "";

  // Only marketing carries it, and when it does it is a plain visible link,
  // not a grey one-pixel afterthought.
  const unsubscribe = input.unsubscribe
    ? `<p style="margin:12px 0 0;font-size:12px;"><a href="${escapeHtml(input.unsubscribe.href)}" style="color:#6b625b;">${escapeHtml(input.unsubscribe.label)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="${localeHrefLang[input.locale]}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3ece5;font-family:${font};-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ece5;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 4px 14px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="52" valign="middle">${logo}</td>
                    <td valign="middle" style="font-family:${serif};font-size:19px;color:#0f1212;">${escapeHtml(input.brand.name)}</td>
                    <td align="right" valign="middle" style="font-size:12px;font-weight:800;letter-spacing:0.16em;color:#d96c61;">GLOWA</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #eadfd6;">
            ${cover}
            <tr>
              <td style="padding:28px 28px 32px;">
                ${badge ? `<div style="margin:0 0 14px;">${badge}</div>` : ""}
                <h1 style="margin:0 0 10px;font-family:${serif};font-size:28px;line-height:1.2;font-weight:600;color:#0f1212;">${escapeHtml(input.heading)}</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#4a4541;white-space:pre-line;">${escapeHtml(input.body)}</p>
                ${ticket}
                ${choices}
                ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${rows}</table>` : ""}
                ${button}
                ${secondary}
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td align="center" style="padding:20px 16px 8px;font-size:12px;line-height:1.7;color:#8a8079;">
                ${input.footerLines.map((line) => escapeHtml(line)).join("<br />")}
                ${unsubscribe}
              </td>
            </tr>
          </table>
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
