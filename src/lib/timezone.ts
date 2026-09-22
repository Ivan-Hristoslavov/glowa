/**
 * Timezone helpers for the admin calendar.
 *
 * Everything in the schedule is rendered in the *salon's* timezone, not the
 * viewer's, so a manager travelling abroad still sees the day their staff are
 * working. These convert between instants and wall-clock minutes in that zone
 * without pulling in a date library.
 */

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
export function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour % 24,
    map.minute,
    map.second,
  );

  return asUtc - date.getTime();
}

/** `YYYY-MM-DD` for an instant, in the given zone. */
export function zonedDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Minutes since local midnight for an instant, in the given zone. */
export function zonedMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return (hour % 24) * 60 + minute;
}

/**
 * The instant at which the clock in `timeZone` reads `dateKey` + `minutes`.
 * The second pass re-reads the offset at the candidate instant, which is what
 * makes the hour around a DST change land correctly.
 */
export function instantFromZoned(dateKey: string, minutes: number, timeZone: string) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  const wallAsUtc = new Date(`${dateKey}T${hh}:${mm}:00Z`);

  const firstPass = new Date(wallAsUtc.getTime() - zoneOffsetMs(wallAsUtc, timeZone));
  return new Date(wallAsUtc.getTime() - zoneOffsetMs(firstPass, timeZone));
}

/** Day-of-week (0 = Sunday) for a `YYYY-MM-DD` key. */
export function dayOfWeekFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

export function addDaysToKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday-first week start for a date key. */
export function startOfWeekKey(dateKey: string) {
  const dow = dayOfWeekFromKey(dateKey);
  const shift = dow === 0 ? -6 : 1 - dow;
  return addDaysToKey(dateKey, shift);
}

export function keyToDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`);
}
