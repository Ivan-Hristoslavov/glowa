import { describe, expect, it } from "vitest";

import { findPlace, formatDistance, matchPlace, parseNear, searchPlaces } from "./places";

describe("searchPlaces", () => {
  it("finds a town by any of its spellings", () => {
    expect(searchPlaces("бург", "BG")[0]?.id).toBe("burgas");
    expect(searchPlaces("burg", "BG")[0]?.id).toBe("burgas");
  });

  it("ignores diacritics, so a phone keyboard finds Romanian cities", () => {
    expect(searchPlaces("iasi", "RO")[0]?.id).toBe("iasi");
    expect(searchPlaces("brasov", "BG")[0]?.id).toBe("brasov");
  });

  it("leads with the visitor's own country when nothing is typed", () => {
    expect(searchPlaces("", "BG")[0]?.country).toBe("BG");
    expect(searchPlaces("", "RO")[0]?.country).toBe("RO");
  });
});

describe("parseNear", () => {
  it("coarsens a point to two decimals", () => {
    expect(parseNear("42.69771,23.32191")).toEqual({ lat: 42.7, lng: 23.32 });
  });

  it("refuses anything malformed or off the globe", () => {
    expect(parseNear("abc")).toBeNull();
    expect(parseNear("95,23")).toBeNull();
    expect(parseNear("42.7")).toBeNull();
    expect(parseNear(null)).toBeNull();
  });
});

describe("formatDistance", () => {
  it("never claims metres from a town-centre point", () => {
    expect(formatDistance(0.3, "en")).toBe("< 1 km");
  });

  it("drops the decimal once it stops meaning anything", () => {
    expect(formatDistance(2.44, "en")).toBe("2.4 km");
    expect(formatDistance(226.6, "en")).toBe("227 km");
  });
});

describe("findPlace", () => {
  it("resolves an id and nothing else", () => {
    expect(findPlace("sofia")?.name.bg).toBe("София");
    expect(findPlace("nowhere")).toBeNull();
    expect(findPlace(undefined)).toBeNull();
  });
});

describe("matchPlace", () => {
  it("matches a town in any spelling, case and accents aside", () => {
    expect(matchPlace("София")?.id).toBe("sofia");
    expect(matchPlace("  sofia ")?.id).toBe("sofia");
    expect(matchPlace("Iasi")?.id).toBe("iasi");
  });

  it("does not guess from a partial or longer name", () => {
    expect(matchPlace("Sof")).toBeNull();
    expect(matchPlace("Sofia centre")).toBeNull();
    expect(matchPlace("")).toBeNull();
  });
});
