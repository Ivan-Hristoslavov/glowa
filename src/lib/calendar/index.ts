import { googleCalendarProvider } from "./google";
import { icsProvider } from "./ics";
import type { CalendarProvider } from "./types";

export const calendarProviders = {
  google: googleCalendarProvider,
  ics: icsProvider,
} satisfies Partial<Record<CalendarProvider["id"], CalendarProvider>>;

export type CalendarProviderId = keyof typeof calendarProviders;

export { buildIcs } from "./ics";
export type { CalendarEvent, CalendarProvider } from "./types";

/** True once Google OAuth credentials exist; the UI hides the flow until then. */
export function isGoogleCalendarConnectable() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
