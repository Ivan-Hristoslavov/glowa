import { describe, expect, it } from "vitest";

import {
  addDaysToKey,
  dayOfWeekFromKey,
  instantFromZoned,
  startOfWeekKey,
  zoneOffsetMs,
  zonedDateKey,
  zonedMinutes,
} from "./timezone";

const SOFIA = "Europe/Sofia";
const BUCHAREST = "Europe/Bucharest";

describe("zoneOffsetMs", () => {
  it("reports +2 in Sofia winter and +3 in summer", () => {
    expect(zoneOffsetMs(new Date("2026-01-15T12:00:00Z"), SOFIA)).toBe(
      2 * 3_600_000,
    );
    expect(zoneOffsetMs(new Date("2026-07-15T12:00:00Z"), SOFIA)).toBe(
      3 * 3_600_000,
    );
  });
});

describe("zonedDateKey", () => {
  it("uses the salon's day, not the viewer's", () => {
    // 22:30 UTC is already the next day in Sofia.
    expect(zonedDateKey(new Date("2026-03-10T22:30:00Z"), SOFIA)).toBe(
      "2026-03-11",
    );
  });
});

describe("zonedMinutes", () => {
  it("counts minutes since local midnight", () => {
    // 06:00 UTC in July is 09:00 in Sofia.
    expect(zonedMinutes(new Date("2026-07-15T06:00:00Z"), SOFIA)).toBe(9 * 60);
  });

  it("returns 0 rather than 1440 at local midnight", () => {
    expect(zonedMinutes(new Date("2026-07-14T21:00:00Z"), SOFIA)).toBe(0);
  });
});

describe("instantFromZoned", () => {
  it("round-trips an ordinary working hour", () => {
    const instant = instantFromZoned("2026-07-15", 10 * 60, SOFIA);
    expect(instant.toISOString()).toBe("2026-07-15T07:00:00.000Z");
    expect(zonedMinutes(instant, SOFIA)).toBe(10 * 60);
  });

  it("is correct on the spring-forward day", () => {
    // EU DST starts 2026-03-29. 09:00 Sofia that morning is 06:00 UTC,
    // one hour earlier in UTC terms than the day before.
    const before = instantFromZoned("2026-03-28", 9 * 60, SOFIA);
    const after = instantFromZoned("2026-03-29", 9 * 60, SOFIA);
    expect(before.toISOString()).toBe("2026-03-28T07:00:00.000Z");
    expect(after.toISOString()).toBe("2026-03-29T06:00:00.000Z");
  });

  it("is correct on the autumn fall-back day", () => {
    // DST ends 2026-10-25. 09:00 Sofia is back to 07:00 UTC.
    const before = instantFromZoned("2026-10-24", 9 * 60, SOFIA);
    const after = instantFromZoned("2026-10-25", 9 * 60, SOFIA);
    expect(before.toISOString()).toBe("2026-10-24T06:00:00.000Z");
    expect(after.toISOString()).toBe("2026-10-25T07:00:00.000Z");
  });

  it("keeps a whole working day at its wall-clock time across the change", () => {
    // Every slot the salon advertises must still read the same on the clock.
    for (const minutes of [9 * 60, 12 * 60, 15 * 60, 18 * 60]) {
      const instant = instantFromZoned("2026-03-29", minutes, SOFIA);
      expect(zonedMinutes(instant, SOFIA)).toBe(minutes);
    }
  });

  it("works for the Romanian market too", () => {
    const instant = instantFromZoned("2026-07-15", 14 * 60, BUCHAREST);
    expect(zonedMinutes(instant, BUCHAREST)).toBe(14 * 60);
  });
});

describe("date key arithmetic", () => {
  it("crosses a month boundary", () => {
    expect(addDaysToKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses a DST boundary without losing a day", () => {
    expect(addDaysToKey("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDaysToKey("2026-10-24", 1)).toBe("2026-10-25");
  });

  it("starts the week on Monday", () => {
    // 2026-09-22 is a Tuesday.
    expect(dayOfWeekFromKey("2026-09-22")).toBe(2);
    expect(startOfWeekKey("2026-09-22")).toBe("2026-09-21");
    // Sunday belongs to the week that started six days earlier.
    expect(startOfWeekKey("2026-09-27")).toBe("2026-09-21");
    expect(startOfWeekKey("2026-09-21")).toBe("2026-09-21");
  });
});
