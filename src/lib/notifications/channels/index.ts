import "server-only";

import type { ChannelAdapter, NotificationChannel } from "../types";

import { consoleEmailChannel } from "./email-console";
import { resendEmailChannel } from "./email-resend";
import { webPushChannel } from "./push-web";

/**
 * Candidates per channel, in preference order. The first configured one wins,
 * so a deployment with a provider key uses it and a laptop without one falls
 * back to the log.
 *
 * SMS, WhatsApp and Viber are real values of `notification_channel` because
 * the schema was designed for them, but GLOWA has no provider for them yet.
 * They resolve to `null` rather than to a stub that pretends: a queued SMS
 * stays queued and visible instead of being marked delivered.
 *
 * Push needs no vendor at all - VAPID keys are self-issued - so it is a real
 * adapter as soon as the keys are in the environment.
 */
const REGISTRY: Record<NotificationChannel, ChannelAdapter[]> = {
  email: [resendEmailChannel, consoleEmailChannel],
  push: [webPushChannel],
  sms: [],
  whatsapp: [],
  viber: [],
};

export function resolveChannel(
  channel: NotificationChannel,
): ChannelAdapter | null {
  return REGISTRY[channel].find((adapter) => adapter.isConfigured()) ?? null;
}

/** For the settings screen: which channels this deployment can actually use. */
export function availableChannels(): NotificationChannel[] {
  return (Object.keys(REGISTRY) as NotificationChannel[]).filter(
    (channel) => resolveChannel(channel) !== null,
  );
}
