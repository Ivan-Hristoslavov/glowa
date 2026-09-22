import "server-only";

import type { ChannelAdapter, OutgoingMessage, SendOutcome } from "../types";

/**
 * Development fallback. Writes the message to the server log and reports
 * success, so the whole queue - trigger, claim, render, status update - can be
 * exercised without a provider account.
 *
 * Deliberately refuses to configure itself in production: a deployment missing
 * its provider key should leave messages queued and visible, not silently
 * mark them sent.
 */
export const consoleEmailChannel: ChannelAdapter = {
  channel: "email",
  provider: "console",

  isConfigured() {
    return process.env.NODE_ENV !== "production";
  },

  async send(message: OutgoingMessage): Promise<SendOutcome> {
    console.info(
      [
        "─".repeat(60),
        `notification · ${message.idempotencyKey} · ${message.locale}`,
        `to: ${message.to.name ?? "-"} <${message.to.email ?? "-"}>`,
        `subject: ${message.subject}`,
        "",
        message.text,
        "─".repeat(60),
      ].join("\n"),
    );
    return { ok: true, providerMessageId: null };
  },
};
