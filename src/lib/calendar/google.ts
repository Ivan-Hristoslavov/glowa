import type { CalendarEvent, CalendarProvider } from "./types";

function toTemplateStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Google Calendar, first as a stateless template link (works for everyone,
 * right now) and second as the OAuth entry point that Prompt 4 completes.
 *
 * `getAuthorizationUrl` returns null unless GOOGLE_CLIENT_ID is configured, so
 * the UI can hide the "connect" affordance instead of offering a dead end.
 */
export const googleCalendarProvider: CalendarProvider = {
  id: "google",

  buildAddUrl(event: CalendarEvent) {
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", event.title);
    url.searchParams.set(
      "dates",
      `${toTemplateStamp(event.startsAt)}/${toTemplateStamp(event.endsAt)}`,
    );
    if (event.description) url.searchParams.set("details", event.description);
    if (event.location) url.searchParams.set("location", event.location);
    return url.toString();
  },

  getAuthorizationUrl({ redirectUri, state }) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return null;

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    // Least privilege: write our own events, read free/busy. Nothing else.
    url.searchParams.set(
      "scope",
      [
        "https://www.googleapis.com/auth/calendar.events.owned",
        "https://www.googleapis.com/auth/calendar.freebusy",
      ].join(" "),
    );
    return url.toString();
  },
};
