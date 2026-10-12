import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { assertSafeUrl, isPublicIp, UnsafeUrlError } = await import("./safe-fetch");

describe("isPublicIp", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "2606:4700:4700::1111",
  ])("allows %s", (address) => {
    expect(isPublicIp(address)).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:10.1.2.3",
    "not-an-ip",
  ])("refuses %s", (address) => {
    expect(isPublicIp(address)).toBe(false);
  });

  it("does not mistake 172.32 or 100.128 for private ranges", () => {
    expect(isPublicIp("172.32.0.1")).toBe(true);
    expect(isPublicIp("100.128.0.1")).toBe(true);
  });
});

describe("assertSafeUrl", () => {
  it("accepts an ordinary https address", () => {
    expect(assertSafeUrl("https://salon.example/hook").hostname).toBe("salon.example");
  });

  it.each([
    ["http://salon.example/hook", "scheme"],
    ["ftp://salon.example/x", "scheme"],
    ["https://user:pass@salon.example/hook", "credentials"],
    ["https://localhost/hook", "host"],
    ["https://db.internal/hook", "host"],
    ["https://127.0.0.1/hook", "address"],
    ["https://169.254.169.254/latest/meta-data", "address"],
    ["https://[::1]/hook", "address"],
    ["not a url", "host"],
  ])("refuses %s", (url, reason) => {
    try {
      assertSafeUrl(url);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsafeUrlError);
      expect((error as InstanceType<typeof UnsafeUrlError>).reason).toBe(reason);
    }
  });
});

describe("private addresses", () => {
  it("stay refused when the development switch is set in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LAVENA_ALLOW_PRIVATE_FETCH", "1");
    expect(() => assertSafeUrl("https://127.0.0.1/hook")).toThrow();
    vi.unstubAllEnvs();
  });
});
