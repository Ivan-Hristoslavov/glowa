import { describe, expect, it } from "vitest";

import { effectiveDepositCents } from "./deposits";

const service = { requiresDeposit: true, depositCents: 1000, priceCents: 5000 };

describe("effectiveDepositCents", () => {
  it("asks for the service's deposit when the salon takes deposits", () => {
    expect(effectiveDepositCents(service, true)).toBe(1000);
  });

  it("asks for nothing while the salon cannot take payments", () => {
    // A service marked "requires deposit" at a salon whose Stripe account is
    // not yet enabled is booked without one, rather than failing at checkout.
    expect(effectiveDepositCents(service, false)).toBe(0);
  });

  it("asks for nothing when the service does not require one", () => {
    expect(effectiveDepositCents({ ...service, requiresDeposit: false }, true)).toBe(0);
    expect(effectiveDepositCents({ ...service, depositCents: 0 }, true)).toBe(0);
  });

  it("never asks for more than the service costs", () => {
    expect(effectiveDepositCents({ ...service, depositCents: 9000 }, true)).toBe(5000);
  });
});
