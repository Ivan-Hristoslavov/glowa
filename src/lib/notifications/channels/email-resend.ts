import "server-only";

import type { ChannelAdapter, OutgoingMessage, SendOutcome } from "../types";

const ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend over plain fetch rather than their SDK: one POST, no dependency, and
 * nothing in the bundle that could drag a secret toward the client.
 *
 * `RESEND_FROM` must be an address on a domain verified in Resend. A
 * mismatched sender is the most common reason a first send 422s.
 */
export const resendEmailChannel: ChannelAdapter = {
  channel: "email",
  provider: "resend",

  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  },

  async send(message: OutgoingMessage): Promise<SendOutcome> {
    if (!message.to.email) {
      return { ok: false, error: "no_email_address", retryable: false };
    }

    const to = message.to.name
      ? `${sanitizeDisplayName(message.to.name)} <${message.to.email}>`
      : message.to.email;

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Resend deduplicates on this for 24h.
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM,
          to: [to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(process.env.RESEND_REPLY_TO
            ? { reply_to: process.env.RESEND_REPLY_TO }
            : {}),
        }),
      });
    } catch (cause) {
      // Network-level: the request may or may not have landed. Retryable, and
      // the idempotency key is what makes that safe.
      return {
        ok: false,
        error: cause instanceof Error ? cause.message : "network_error",
        retryable: true,
      };
    }

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;
      return { ok: true, providerMessageId: body?.id ?? null };
    }

    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      error: `resend_${response.status}: ${detail.slice(0, 300)}`,
      // 4xx other than rate limiting is a rejection of this exact request;
      // sending it again unchanged produces the same answer.
      retryable: response.status === 429 || response.status >= 500,
    };
  },
};

/** Keeps a display name from breaking out of the RFC 5322 address. */
function sanitizeDisplayName(name: string) {
  return name.replace(/["<>\\\r\n]/g, "").trim() || "GLOWA";
}
