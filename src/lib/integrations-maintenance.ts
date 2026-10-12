import "server-only";

import { runCalendarFeedSync, type FeedSyncReport } from "@/lib/calendar-feeds/sync";
import { runWebhookWorker, type WebhookReport } from "@/lib/webhooks/worker";

export type IntegrationsReport = { webhooks: WebhookReport | null; feeds: FeedSyncReport | null };

/**
 * The scheduled part of the integrations: deliver queued webhooks, refresh the
 * calendar feeds. Each half fails alone - a broken feed must not hold back
 * webhooks, and neither may take the notification run down with it.
 */
export async function runIntegrationsMaintenance(): Promise<IntegrationsReport> {
  const [webhooks, feeds] = await Promise.all([
    runWebhookWorker(50).catch((cause) => {
      console.error("webhook worker failed", cause);
      return null;
    }),
    runCalendarFeedSync(20).catch((cause) => {
      console.error("calendar feed sync failed", cause);
      return null;
    }),
  ]);
  return { webhooks, feeds };
}
