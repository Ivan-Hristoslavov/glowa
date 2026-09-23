import type { Locale } from "@/i18n/routing";
import type { Database } from "@/types/database";

export type NotificationChannel =
  Database["public"]["Enums"]["notification_channel"];
export type NotificationEvent =
  Database["public"]["Enums"]["notification_event"];
export type NotificationDelivery =
  Database["public"]["Tables"]["notification_deliveries"]["Row"];

export type Recipient = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

/** What a channel is handed. Rendering already happened; this is transport. */
export type OutgoingMessage = {
  to: Recipient;
  locale: Locale;
  subject: string;
  text: string;
  html: string;
  /**
   * Passed to the provider so that a retry after an ambiguous failure - the
   * request went out, the response never came back - is deduplicated on their
   * side too. Our own unique key only protects against re-enqueueing.
   */
  idempotencyKey: string;
  /**
   * Set when the recipient has a GLOWA account. Email does not need it; push
   * does, because a subscription belongs to a person rather than an address.
   */
  profileId?: string | null;
  /** Where tapping the notification should land. */
  url?: string;
};

export type SendOutcome =
  | { ok: true; providerMessageId: string | null }
  | {
      ok: false;
      error: string;
      /**
       * False for a permanent rejection (malformed address, blocked
       * recipient). The worker stops retrying those immediately instead of
       * burning five attempts on an answer that will not change.
       */
      retryable: boolean;
    };

/**
 * A channel is a transport, not a feature. Adding SMS means adding a file
 * here; nothing above this interface learns about it. `isConfigured` is what
 * lets a deployment run without every provider key present: an unconfigured
 * channel reports itself rather than throwing at send time.
 */
export interface ChannelAdapter {
  readonly channel: NotificationChannel;
  readonly provider: string;
  isConfigured(): boolean;
  send(message: OutgoingMessage): Promise<SendOutcome>;
}
