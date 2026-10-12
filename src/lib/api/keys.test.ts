import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { bearerKey, generateApiKey, generateWebhookSecret, hashApiKey } = await import("./keys");

describe("api keys", () => {
  it("makes distinct keys whose hash matches", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.key.startsWith("lv_live_")).toBe(true);
    expect(a.prefix).toBe(a.key.slice(0, 12));
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).not.toContain(a.key);
  });

  it("reads a bearer key from the header", () => {
    const { key } = generateApiKey();
    const request = new Request("https://x.test", { headers: { authorization: `Bearer ${key}` } });
    expect(bearerKey(request)).toBe(key);
  });

  it("refuses anything that is not a Lavena bearer key", () => {
    for (const value of [undefined, "", "Bearer", "Bearer abc", "Basic lv_live_aaaaaaaaaaaaaaaaaaaaaaaa", "lv_live_aaaaaaaaaaaaaaaaaaaaaaaa"]) {
      const request = new Request("https://x.test", value ? { headers: { authorization: value } } : undefined);
      expect(bearerKey(request)).toBeNull();
    }
  });

  it("makes webhook secrets long enough for the database check", () => {
    expect(generateWebhookSecret().length).toBeGreaterThanOrEqual(24);
  });
});
