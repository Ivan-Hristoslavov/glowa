import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resendEmailChannel } from "./email-resend";
import type { OutgoingMessage } from "../types";

const message: OutgoingMessage = {
  to: { name: "QA Customer", email: "qa@example.com", phone: null },
  locale: "bg",
  subject: "Часът ви е запазен",
  text: "body",
  html: "<p>body</p>",
  idempotencyKey: "booking_confirmation:abc",
};

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM = "GLOWA <bookings@example.com>";
  delete process.env.RESEND_REPLY_TO;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function mockFetch(status: number) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ id: "msg_1" }),
    text: async () => "detail",
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("isConfigured", () => {
  it("needs both the key and a verified sender", () => {
    expect(resendEmailChannel.isConfigured()).toBe(true);
    delete process.env.RESEND_FROM;
    expect(resendEmailChannel.isConfigured()).toBe(false);
  });
});

describe("send", () => {
  it("passes the idempotency key to the provider", async () => {
    const spy = mockFetch(200);
    const result = await resendEmailChannel.send(message);

    expect(result).toEqual({ ok: true, providerMessageId: "msg_1" });
    const [, init] = spy.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBe("booking_confirmation:abc");
  });

  it("quotes the display name so a comma cannot add a second recipient", async () => {
    const spy = mockFetch(200);
    await resendEmailChannel.send({
      ...message,
      to: { ...message.to, name: 'Eve" <attacker@evil.test>, "' },
    });

    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body.to).toEqual([
      String.raw`"Eve\" <attacker@evil.test>, \"" <qa@example.com>`,
    ]);
  });

  it("drops CR and LF, which no amount of quoting would make safe", async () => {
    const spy = mockFetch(200);
    await resendEmailChannel.send({
      ...message,
      to: { ...message.to, name: "Eve\r\nBcc: attacker@evil.test" },
    });

    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body.to[0]).not.toMatch(/[\r\n]/);
    expect(body.to).toEqual(['"Eve Bcc: attacker@evil.test" <qa@example.com>']);
  });

  it("falls back to the bare address when there is no usable name", async () => {
    const spy = mockFetch(200);
    await resendEmailChannel.send({
      ...message,
      to: { ...message.to, name: "   " },
    });

    expect(JSON.parse(spy.mock.calls[0][1].body).to).toEqual([
      "qa@example.com",
    ]);
  });

  it("refuses without an address instead of calling the provider", async () => {
    const spy = mockFetch(200);
    const result = await resendEmailChannel.send({
      ...message,
      to: { ...message.to, email: null },
    });

    expect(result).toEqual({
      ok: false,
      error: "no_email_address",
      retryable: false,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("treats a 422 as permanent and a 429 or 500 as retryable", async () => {
    for (const [status, retryable] of [
      [422, false],
      [429, true],
      [500, true],
    ] as const) {
      mockFetch(status);
      const result = await resendEmailChannel.send(message);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.retryable).toBe(retryable);
    }
  });

  it("treats a network failure as retryable, because the send may have landed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("socket hang up")),
    );

    const result = await resendEmailChannel.send(message);
    expect(result).toEqual({
      ok: false,
      error: "socket hang up",
      retryable: true,
    });
  });
});
