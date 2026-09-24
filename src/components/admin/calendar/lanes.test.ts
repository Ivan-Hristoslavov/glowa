import { describe, expect, it } from "vitest";

import { layoutLanes, staffTracks } from "./lanes";

describe("layoutLanes", () => {
  it("gives non-overlapping items the full width", () => {
    const lanes = layoutLanes([
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 600, end: 660 },
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get("b")).toEqual({ lane: 0, lanes: 1 });
  });

  it("puts overlapping items side by side", () => {
    const lanes = layoutLanes([
      { id: "a", start: 540, end: 660 },
      { id: "b", start: 570, end: 630 },
      { id: "c", start: 600, end: 690 },
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 3 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 3 });
    expect(lanes.get("c")).toEqual({ lane: 2, lanes: 3 });
  });

  it("reuses a lane once it is free, within the same cluster", () => {
    const lanes = layoutLanes([
      { id: "a", start: 540, end: 720 },
      { id: "b", start: 540, end: 600 },
      { id: "c", start: 600, end: 660 },
    ]);
    expect(lanes.get("b")?.lane).toBe(1);
    expect(lanes.get("c")?.lane).toBe(1);
    expect(lanes.get("c")?.lanes).toBe(2);
  });
});

describe("staffTracks", () => {
  it("keeps each stylist on the same track, booked or not", () => {
    const lanes = staffTracks(
      [
        { id: "a", start: 540, end: 600, staffId: "ivan" },
        { id: "b", start: 540, end: 600, staffId: "eva" },
      ],
      ["ivan", "maria", "eva"],
    );
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 3 });
    expect(lanes.get("b")).toEqual({ lane: 2, lanes: 3 });
  });

  it("falls back to overlap lanes when one stylist's items collide", () => {
    const lanes = staffTracks(
      [
        { id: "a", start: 540, end: 600, staffId: "ivan" },
        { id: "b", start: 570, end: 630, staffId: "ivan" },
      ],
      ["ivan", "eva"],
    );
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
  });
});
