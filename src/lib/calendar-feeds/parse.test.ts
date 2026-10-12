import { describe, expect, it } from "vitest";

import { parseBusyBlocks } from "./parse";

const wrap = (body: string, head = "") =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\n${head}${body}END:VCALENDAR\r\n`;

const window = {
  timezone: "Europe/Sofia",
  windowStart: new Date("2026-10-01T00:00:00Z"),
  windowEnd: new Date("2026-12-31T00:00:00Z"),
};

const event = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join("\r\n")}\r\nEND:VEVENT\r\n`;

describe("parseBusyBlocks", () => {
  it("reads a UTC event", () => {
    const blocks = parseBusyBlocks(
      wrap(event(["UID:1", "DTSTART:20261020T080000Z", "DTEND:20261020T090000Z", "SUMMARY:secret"])),
      window,
    );
    expect(blocks).toEqual([{ starts_at: "2026-10-20T08:00:00.000Z", ends_at: "2026-10-20T09:00:00.000Z" }]);
  });

  it("puts a named zone with no VTIMEZONE in the right place (Sofia is UTC+3 in October)", () => {
    const blocks = parseBusyBlocks(
      wrap(event(["UID:2", "DTSTART;TZID=Europe/Sofia:20261021T100000", "DTEND;TZID=Europe/Sofia:20261021T110000"])),
      window,
    );
    expect(blocks[0].starts_at).toBe("2026-10-21T07:00:00.000Z");
    expect(blocks[0].ends_at).toBe("2026-10-21T08:00:00.000Z");
  });

  it("follows daylight saving: the same wall time in December is UTC+2", () => {
    const blocks = parseBusyBlocks(
      wrap(event(["UID:3", "DTSTART;TZID=Europe/Sofia:20261210T100000", "DTEND;TZID=Europe/Sofia:20261210T110000"])),
      window,
    );
    expect(blocks[0].starts_at).toBe("2026-12-10T08:00:00.000Z");
  });

  it("reads a floating time in the salon's own zone (clocks went back on 25 Oct: UTC+2)", () => {
    const blocks = parseBusyBlocks(
      wrap(event(["UID:4", "DTSTART:20261026T100000", "DTEND:20261026T110000"])),
      window,
    );
    expect(blocks[0].starts_at).toBe("2026-10-26T08:00:00.000Z");
  });

  it("blocks a whole day for an all-day event, on the salon's clock", () => {
    const blocks = parseBusyBlocks(
      wrap(event(["UID:5", "DTSTART;VALUE=DATE:20261025", "DTEND;VALUE=DATE:20261026"])),
      window,
    );
    expect(blocks).toEqual([{ starts_at: "2026-10-24T21:00:00.000Z", ends_at: "2026-10-25T22:00:00.000Z" }]);
  });

  it("expands a weekly series and honours an excluded date", () => {
    const blocks = parseBusyBlocks(
      wrap(
        event([
          "UID:6",
          "DTSTART;TZID=Europe/Sofia:20261021T100000",
          "DTEND;TZID=Europe/Sofia:20261021T110000",
          "RRULE:FREQ=WEEKLY;COUNT=4",
          "EXDATE;TZID=Europe/Sofia:20261028T100000",
        ]),
      ),
      window,
    );
    expect(blocks.map((b) => b.starts_at.slice(0, 10))).toEqual(["2026-10-21", "2026-11-04", "2026-11-11"]);
  });

  it("applies a moved occurrence of a series", () => {
    const blocks = parseBusyBlocks(
      wrap(
        event([
          "UID:7",
          "DTSTART:20261021T080000Z",
          "DTEND:20261021T090000Z",
          "RRULE:FREQ=WEEKLY;COUNT=2",
        ]) +
          event([
            "UID:7",
            "RECURRENCE-ID:20261028T080000Z",
            "DTSTART:20261028T120000Z",
            "DTEND:20261028T130000Z",
          ]),
      ),
      window,
    );
    expect(blocks.map((b) => b.starts_at)).toEqual(["2026-10-21T08:00:00.000Z", "2026-10-28T12:00:00.000Z"]);
  });

  it("ignores events marked free and cancelled ones", () => {
    const blocks = parseBusyBlocks(
      wrap(
        event(["UID:8", "DTSTART:20261020T080000Z", "DTEND:20261020T090000Z", "TRANSP:TRANSPARENT"]) +
          event(["UID:9", "DTSTART:20261021T080000Z", "DTEND:20261021T090000Z", "STATUS:CANCELLED"]),
      ),
      window,
    );
    expect(blocks).toEqual([]);
  });

  it("drops what is outside the window and clips what straddles it", () => {
    const blocks = parseBusyBlocks(
      wrap(
        event(["UID:10", "DTSTART:20250101T080000Z", "DTEND:20250101T090000Z"]) +
          event(["UID:11", "DTSTART:20260930T230000Z", "DTEND:20261001T020000Z"]),
      ),
      window,
    );
    expect(blocks).toEqual([{ starts_at: "2026-10-01T00:00:00.000Z", ends_at: "2026-10-01T02:00:00.000Z" }]);
  });

  it("merges overlapping and touching blocks", () => {
    const blocks = parseBusyBlocks(
      wrap(
        event(["UID:12", "DTSTART:20261020T080000Z", "DTEND:20261020T100000Z"]) +
          event(["UID:13", "DTSTART:20261020T090000Z", "DTEND:20261020T110000Z"]) +
          event(["UID:14", "DTSTART:20261020T110000Z", "DTEND:20261020T120000Z"]),
      ),
      window,
    );
    expect(blocks).toEqual([{ starts_at: "2026-10-20T08:00:00.000Z", ends_at: "2026-10-20T12:00:00.000Z" }]);
  });

  it("uses a VTIMEZONE the file describes itself", () => {
    const vtimezone =
      "BEGIN:VTIMEZONE\r\nTZID:Custom Zone\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0500\r\nTZOFFSETTO:+0500\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n";
    const blocks = parseBusyBlocks(
      wrap(event(["UID:15", "DTSTART;TZID=Custom Zone:20261020T100000", "DTEND;TZID=Custom Zone:20261020T110000"]), vtimezone),
      window,
    );
    expect(blocks[0].starts_at).toBe("2026-10-20T05:00:00.000Z");
  });

  it("caps the number of blocks", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      event([`UID:m${i}`, `DTSTART:202610${String(10 + i).padStart(2, "0")}T080000Z`, `DTEND:202610${String(10 + i).padStart(2, "0")}T090000Z`]),
    ).join("");
    expect(parseBusyBlocks(wrap(many), { ...window, maxBlocks: 3 })).toHaveLength(3);
  });

  it("throws on something that is not a calendar", () => {
    expect(() => parseBusyBlocks("<html>not ical</html>", window)).toThrow();
  });
});
