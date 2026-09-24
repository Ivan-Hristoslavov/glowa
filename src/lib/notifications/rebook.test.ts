import { describe, expect, it } from "vitest";

import { localDay, pickInvitationSlots, weeksFromDays } from "./rebook";

const ZONE = "Europe/Sofia"; // UTC+3 in October (summer time until the 25th)

function slot(iso: string) {
  return { starts_at: iso, staff_profile_id: "s1" };
}

describe("pickInvitationSlots", () => {
  const now = new Date("2026-10-12T06:00:00Z"); // 09:00 in Sofia

  it("takes one slot per day, closest to the previous visit's time of day", () => {
    const picked = pickInvitationSlots(
      [
        slot("2026-10-13T07:00:00Z"), // 10:00
        slot("2026-10-13T15:00:00Z"), // 18:00
        slot("2026-10-13T15:30:00Z"), // 18:30 <- closest to 18:30
        slot("2026-10-14T08:00:00Z"), // 11:00 <- only one that day
      ],
      { previousStartsAt: "2026-09-21T15:30:00Z", timeZone: ZONE, now },
    );
    expect(picked.map((entry) => entry.starts_at)).toEqual([
      "2026-10-13T15:30:00Z",
      "2026-10-14T08:00:00Z",
    ]);
  });

  it("offers at most three days, in date order", () => {
    const days = ["2026-10-16", "2026-10-13", "2026-10-15", "2026-10-14"];
    const picked = pickInvitationSlots(
      days.map((day) => slot(`${day}T09:00:00Z`)),
      { previousStartsAt: "2026-09-21T09:00:00Z", timeZone: ZONE, now },
    );
    expect(picked.map((entry) => entry.starts_at.slice(0, 10))).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
    ]);
  });

  it("drops anything that starts too soon to be useful", () => {
    const picked = pickInvitationSlots(
      [slot("2026-10-12T07:00:00Z"), slot("2026-10-12T09:00:00Z")],
      { previousStartsAt: "2026-09-21T07:00:00Z", timeZone: ZONE, now },
    );
    expect(picked.map((entry) => entry.starts_at)).toEqual(["2026-10-12T09:00:00Z"]);
  });

  it("groups by the salon's day, not UTC's", () => {
    // 22:30 UTC on the 13th is 01:30 on the 14th in Sofia.
    expect(localDay("2026-10-13T22:30:00Z", ZONE)).toBe("2026-10-14");
    const picked = pickInvitationSlots(
      [slot("2026-10-13T20:00:00Z"), slot("2026-10-13T22:30:00Z")],
      { previousStartsAt: "2026-09-21T20:00:00Z", timeZone: ZONE, now },
    );
    expect(picked).toHaveLength(2);
  });

  it("returns nothing when there is nothing", () => {
    expect(
      pickInvitationSlots([], { previousStartsAt: "2026-09-21T09:00:00Z", timeZone: ZONE, now }),
    ).toEqual([]);
  });
});

describe("weeksFromDays", () => {
  it("rounds to whole weeks and never says zero", () => {
    expect(weeksFromDays(21)).toBe(3);
    expect(weeksFromDays(45)).toBe(6);
    expect(weeksFromDays(7)).toBe(1);
    expect(weeksFromDays(3)).toBe(1);
  });
});
