import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { availableChannels, resolveChannel } from "./index";

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function setNodeEnv(value: string) {
  // NODE_ENV is readonly in the Next types; `unstubEnvs` puts it back.
  vi.stubEnv("NODE_ENV", value as "development" | "production");
}

describe("resolveChannel", () => {
  it("prefers the real provider over the console fallback", () => {
    setNodeEnv("development");
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "GLOWA <bookings@example.com>";

    expect(resolveChannel("email")?.provider).toBe("resend");
  });

  it("falls back to the console adapter in development", () => {
    setNodeEnv("development");
    expect(resolveChannel("email")?.provider).toBe("console");
  });

  it("resolves to nothing in production without a provider key", () => {
    // The point of the whole design: a missing key leaves messages queued and
    // visible rather than logging them and marking them sent.
    setNodeEnv("production");
    expect(resolveChannel("email")).toBeNull();
  });

  it("has no adapter for the channels GLOWA cannot actually send", () => {
    setNodeEnv("development");
    for (const channel of ["sms", "whatsapp", "viber"] as const) {
      expect(resolveChannel(channel)).toBeNull();
    }
  });

  it("resolves push only once VAPID keys are present", () => {
    setNodeEnv("production");
    // Web Push needs no vendor account, so the adapter is real - but it still
    // must not pretend to work with no keys to sign with.
    expect(resolveChannel("push")).toBeNull();

    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private");
    expect(resolveChannel("push")?.provider).toBe("web-push");
  });
});

describe("availableChannels", () => {
  it("reports only what this deployment can send", () => {
    setNodeEnv("development");
    expect(availableChannels()).toEqual(["email"]);

    setNodeEnv("production");
    expect(availableChannels()).toEqual([]);
  });
});
