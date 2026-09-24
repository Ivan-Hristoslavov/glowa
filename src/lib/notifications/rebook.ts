/**
 * Which free times a rebook invitation offers.
 *
 * People keep routines: somebody who came at 18:30 after work is unlikely to
 * take 10:00. So each day contributes the one slot closest to the time of day
 * of the visit being followed up, and the message offers the first few days
 * that have anything - three real choices rather than one day's whole list.
 * Anything starting too soon to be useful is dropped.
 */
export type SlotCandidate = { starts_at: string; staff_profile_id: string | null };

export function pickInvitationSlots(
  slots: SlotCandidate[],
  options: {
    /** The visit being followed up; its local time of day is the target. */
    previousStartsAt: string;
    timeZone: string;
    now?: Date;
    max?: number;
    minLeadMinutes?: number;
  },
): SlotCandidate[] {
  const now = options.now ?? new Date();
  const max = options.max ?? 3;
  const earliest = now.getTime() + (options.minLeadMinutes ?? 120) * 60_000;
  const target = minutesOfDay(options.previousStartsAt, options.timeZone);

  const bestPerDay = new Map<string, { slot: SlotCandidate; distance: number }>();
  for (const slot of slots) {
    const at = new Date(slot.starts_at).getTime();
    if (!Number.isFinite(at) || at < earliest) continue;

    const day = localDay(slot.starts_at, options.timeZone);
    const distance = Math.abs(minutesOfDay(slot.starts_at, options.timeZone) - target);
    const current = bestPerDay.get(day);
    if (
      !current ||
      distance < current.distance ||
      (distance === current.distance && slot.starts_at < current.slot.starts_at)
    ) {
      bestPerDay.set(day, { slot, distance });
    }
  }

  return [...bestPerDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, max)
    .map(([, value]) => value.slot);
}

/** Whole weeks, never less than one, for "it has been N weeks". */
export function weeksFromDays(days: number) {
  return Math.max(1, Math.round(days / 7));
}

function minutesOfDay(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** YYYY-MM-DD of the instant in the salon's zone, sortable as a string. */
export function localDay(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}
