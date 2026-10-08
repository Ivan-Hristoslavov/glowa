import { describe, expect, it } from "vitest";

import { signWebhook, verifyWebhook } from "./sign";

const secret = "whsec_test_secret_value_0123456789";
const body = JSON.stringify({ id: "evt_1", type: "booking.created" });

describe("webhook signature", () => {
  it("verifies what it signed", () => {
    const header = signWebhook(secret, 1_800_000_000, body);
    expect(verifyWebhook(secret, header, body, 300, 1_800_000_100)).toBe(true);
  });

  it("rejects a changed body", () => {
    const header = signWebhook(secret, 1_800_000_000, body);
    expect(verifyWebhook(secret, header, body + " ", 300, 1_800_000_100)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const header = signWebhook(secret, 1_800_000_000, body);
    expect(verifyWebhook("whsec_other_secret_value_0123456", header, body, 300, 1_800_000_100)).toBe(false);
  });

  it("rejects a replay outside the tolerance", () => {
    const header = signWebhook(secret, 1_800_000_000, body);
    expect(verifyWebhook(secret, header, body, 300, 1_800_000_900)).toBe(false);
  });

  it("rejects a malformed header", () => {
    expect(verifyWebhook(secret, "garbage", body)).toBe(false);
    expect(verifyWebhook(secret, "t=abc,v1=00", body)).toBe(false);
  });
});
