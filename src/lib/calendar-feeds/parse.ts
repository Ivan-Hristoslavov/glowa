import { TZDate } from "@date-fns/tz";
import ICAL from "ical.js";

export type BusyBlock = { starts_at: string; ends_at: string };

type Options = {
  /** Zone for all-day events and for times written without any zone. */
  timezone: string;
  windowStart: Date;
  windowEnd: Date;
  /** The database keeps at most this many blocks per feed. */
  maxBlocks?: number;
};

const MAX_OCCURRENCES_PER_EVENT = 800;

function isIana(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * One moment from an iCal time. Exporters disagree about zones: UTC with a
 * `Z`, a TZID the file describes in a VTIMEZONE, a bare TZID the file does not
 * describe (Google, Apple), a floating time, a whole day. Each is turned into a
 * real instant here, in the salon's zone where the file says nothing.
 */
function toInstant(time: ICAL.Time, tzidParam: string | null, fallbackZone: string): Date {
  const parts = [time.year, time.month - 1, time.day] as const;

  if (time.isDate) {
    return new TZDate(parts[0], parts[1], parts[2], 0, 0, 0, fallbackZone);
  }
  const zoneId = time.zone?.tzid;
  if (zoneId === "UTC") return time.toJSDate();

  const named = zoneId && zoneId !== "floating" ? zoneId : tzidParam;
  const zone = named && isIana(named) ? named : null;
  if (zone) {
    return new TZDate(parts[0], parts[1], parts[2], time.hour, time.minute, time.second, zone);
  }
  if (zoneId && zoneId !== "floating") return time.toJSDate(); // zone described by the file itself
  return new TZDate(parts[0], parts[1], parts[2], time.hour, time.minute, time.second, fallbackZone);
}

function tzidOf(vevent: ICAL.Component, name: "dtstart" | "dtend") {
  const prop = vevent.getFirstProperty(name);
  const value = prop?.getParameter("tzid");
  return typeof value === "string" ? value : null;
}

/**
 * The busy time in an iCal file, inside a window, as merged blocks.
 *
 * Skipped on purpose: events marked free (TRANSPARENT), cancelled ones, and
 * anything outside the window. Recurring events are expanded with their
 * exceptions. What the events are *called* is never read - a private calendar
 * does not need to share titles to say "busy".
 */
export function parseBusyBlocks(text: string, options: Options): BusyBlock[] {
  const { timezone, windowStart, windowEnd } = options;
  const maxBlocks = options.maxBlocks ?? 2000;

  ICAL.TimezoneService.reset();
  const root = new ICAL.Component(ICAL.parse(text));
  for (const vtimezone of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(new ICAL.Timezone(vtimezone));
  }

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  const singles: { event: ICAL.Event; vevent: ICAL.Component }[] = [];
  const vevents = new Map<ICAL.Event, ICAL.Component>();

  for (const vevent of root.getAllSubcomponents("vevent")) {
    if (String(vevent.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") continue;
    if (String(vevent.getFirstPropertyValue("transp") ?? "").toUpperCase() === "TRANSPARENT") continue;
    if (!vevent.hasProperty("dtstart")) continue;

    const event = new ICAL.Event(vevent);
    vevents.set(event, vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else if (event.isRecurring()) masters.set(event.uid, event);
    else singles.push({ event, vevent });
  }

  for (const exception of exceptions) masters.get(exception.uid)?.relateException(exception);

  const raw: { start: Date; end: Date }[] = [];
  const push = (start: Date, end: Date) => {
    if (end <= start) return;
    if (end <= windowStart || start >= windowEnd) return;
    raw.push({
      start: start < windowStart ? windowStart : start,
      end: end > windowEnd ? windowEnd : end,
    });
  };

  const startZone = (vevent: ICAL.Component) => tzidOf(vevent, "dtstart");
  const endZone = (vevent: ICAL.Component) => tzidOf(vevent, "dtend") ?? tzidOf(vevent, "dtstart");

  for (const { event, vevent } of singles) {
    push(
      toInstant(event.startDate, startZone(vevent), timezone),
      toInstant(event.endDate, endZone(vevent), timezone),
    );
  }

  for (const master of masters.values()) {
    const vevent = vevents.get(master)!;
    const iterator = master.iterator();
    let next: ICAL.Time | null;
    let count = 0;
    while ((next = iterator.next()) && count < MAX_OCCURRENCES_PER_EVENT) {
      count += 1;
      const details = master.getOccurrenceDetails(next);
      const start = toInstant(details.startDate, startZone(vevent), timezone);
      if (start >= windowEnd) break;
      push(start, toInstant(details.endDate, endZone(vevent), timezone));
    }
  }

  raw.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: { start: Date; end: Date }[] = [];
  for (const block of raw) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) {
      if (block.end > last.end) last.end = block.end;
    } else {
      merged.push({ ...block });
    }
  }

  return merged.slice(0, maxBlocks).map((b) => ({
    starts_at: new Date(b.start.getTime()).toISOString(),
    ends_at: new Date(b.end.getTime()).toISOString(),
  }));
}
