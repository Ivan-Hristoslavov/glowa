import "server-only";

import { getLocale, getTranslations } from "next-intl/server";

import { publicEnv } from "@/lib/env";

import { resolveChannel } from "./channels";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Tells someone they have been invited to a salon's team.
 *
 * Until this existed the invitee had to be told out of band: the invitation is
 * a membership row waiting for an account with that email, and nothing said so.
 * It goes straight through the email channel instead of the notification
 * outbox because the outbox is keyed to appointments, and a team invitation
 * has none; one invitation is one send, and the owner is told whether it went.
 *
 * Returns whether an email was handed to a provider. No provider key, or a
 * rejected send, is `false` - the invitation itself is already saved.
 */
export async function sendTeamInvitation(input: {
  email: string;
  businessName: string;
  role: "admin" | "manager" | "staff";
}) {
  const channel = resolveChannel("email");
  if (!channel) return false;

  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "admin.staff.inviteMail" });
  const roles = await getTranslations({ locale, namespace: "admin.staff.role" });

  const signup = `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/${locale}/signup?next=${encodeURIComponent(`/${locale}/dashboard`)}`;
  const vars = { business: input.businessName, role: roles(input.role) };
  const body = t("body", vars);

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#fbf9f7;font-family:Arial,Helvetica,sans-serif;color:#111114;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #ebe6e1;border-radius:20px;">
<tr><td style="padding:28px 32px 0;font-size:13px;font-weight:800;letter-spacing:0.16em;color:#7556b5;">LAVENA</td></tr>
<tr><td style="padding:12px 32px 0;font-size:22px;line-height:1.3;font-weight:700;">${escapeHtml(t("heading", vars))}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.55;color:#4b4658;">${escapeHtml(body)}</td></tr>
<tr><td style="padding:24px 32px 28px;"><a href="${signup}" style="display:inline-block;background:#7556b5;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:14px;">${escapeHtml(t("button"))}</a></td></tr>
</table></td></tr></table></body></html>`;

  const outcome = await channel.send({
    to: { name: null, email: input.email, phone: null },
    locale: locale as "bg" | "en" | "ro",
    subject: t("subject", vars),
    text: `${t("heading", vars)}\n\n${body}\n\n${signup}`,
    html,
    idempotencyKey: `team-invite:${input.email}:${input.businessName}:${Date.now()}`,
  });
  return outcome.ok;
}
