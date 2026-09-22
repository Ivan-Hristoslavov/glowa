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
    for (const channel of ["sms", "whatsapp", "viber", "push"] as const) {
      expect(resolveChannel(channel)).toBeNull();
    }
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
