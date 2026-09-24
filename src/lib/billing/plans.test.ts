import { describe, expect, it } from "vitest";

import { isLiveSubscription, parsePriceLookupKey, priceLookupKey } from "@/lib/billing/plans";

describe("price lookup keys", () => {
  it("round-trip every plan and interval", () => {
    for (const plan of ["solo", "studio", "salon"] as const) {
      for (const interval of ["month", "year"] as const) {
        expect(parsePriceLookupKey(priceLookupKey(plan, interval))).toEqual({ plan, interval });
      }
    }
  });

  it("ignore prices that are not ours", () => {
    expect(parsePriceLookupKey("glowa_enterprise_month")).toBeNull();
    expect(parsePriceLookupKey("other_solo_month")).toBeNull();
    expect(parsePriceLookupKey(null)).toBeNull();
  });
});

describe("live subscriptions", () => {
  it("count a failing card as still subscribed, a cancellation as not", () => {
    expect(isLiveSubscription("active")).toBe(true);
    expect(isLiveSubscription("past_due")).toBe(true);
    expect(isLiveSubscription("canceled")).toBe(false);
    expect(isLiveSubscription(undefined)).toBe(false);
  });
});
