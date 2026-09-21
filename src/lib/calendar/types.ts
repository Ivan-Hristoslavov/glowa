export type CalendarEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  url?: string | null;
};

/**
 * Calendar integrations are reached only through this interface, so a second
 * provider is an added file rather than a change to the booking code.
 *
 * `buildAddUrl` is the stateless path that works today: a link the customer
 * clicks, with no account connected. `connect`/`syncEvent` describe the
 * OAuth-backed path; Google is wired up in Prompt 4, and providers that do not
 * support it return null from `getAuthorizationUrl`.
 */
export interface CalendarProvider {
  readonly id: "google" | "apple" | "ics";
  buildAddUrl(event: CalendarEvent): string | null;
  getAuthorizationUrl?(params: {
    redirectUri: string;
    state: string;
  }): string | null;
}
