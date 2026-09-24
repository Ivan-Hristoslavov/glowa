import { describe, expect, it } from "vitest";

import { glowaMonthlyCents, typicalMonthlyCents } from "./pricing";

describe("glowaMonthlyCents", () => {
  it("picks the smallest plan that fits the team", () => {
    expect(glowaMonthlyCents(1)).toBe(600);
    expect(glowaMonthlyCents(2)).toBe(1200);
    expect(glowaMonthlyCents(5)).toBe(1200);
    expect(glowaMonthlyCents(6)).toBe(2400);
    expect(glowaMonthlyCents(40)).toBe(2400);
  });

  it("uses the yearly rate when asked", () => {
    expect(glowaMonthlyCents(1, true)).toBe(500);
    expect(glowaMonthlyCents(3, true)).toBe(1000);
  });
});

describe("typicalMonthlyCents", () => {
  it("charges a seat subscription plus commission on each new client", () => {
    // 3 seats x 12.00 + 10 new clients x 20% of 40.00
    expect(typicalMonthlyCents(3, 10, 4000)).toBe(3600 + 10 * 800);
  });

  it("applies the minimum commission on cheap visits", () => {
    expect(typicalMonthlyCents(1, 2, 1000)).toBe(1700 + 2 * 500);
  });
});
