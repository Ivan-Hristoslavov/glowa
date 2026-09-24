import { describe, expect, it } from "vitest";

import { CONSENT_VERSION, parseConsent, serializeConsent } from "@/lib/consent";

describe("consent cookie", () => {
  it("round-trips a choice", () => {
    const value = serializeConsent({ attribution: true, decidedAt: 1758700000 });
    expect(value).toBe(`${CONSENT_VERSION}.1.1758700000`);
    expect(parseConsent(value)).toEqual({ attribution: true, decidedAt: 1758700000 });
  });

  it("treats a refusal as a decision", () => {
    expect(parseConsent(serializeConsent({ attribution: false, decidedAt: 1 }))).toEqual({
      attribution: false,
      decidedAt: 1,
    });
  });

  it("asks again after a version change or a malformed value", () => {
    expect(parseConsent(`${CONSENT_VERSION + 1}.1.1758700000`)).toBeNull();
    expect(parseConsent("garbage")).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });
});
