import "server-only";

import dns from "node:dns";
import https from "node:https";
import net from "node:net";

/**
 * Outbound requests to an address a salon typed in (a webhook, an iCal feed).
 *
 * Without care that is a way to make our server call things only it can reach:
 * the cloud metadata service, a database on a private network, localhost. So:
 *
 *   - https only, no credentials in the URL;
 *   - every address the name resolves to is checked *when the socket connects*
 *     (a name that answers with a public address now and a private one a
 *     moment later cannot slip through a check done earlier);
 *   - redirects are never followed - the answer is the answer;
 *   - a hard timeout and a size cap on the body.
 */

/**
 * Local development and the browser tests need a receiver on localhost. That
 * is allowed only outside production and only when asked for explicitly, so a
 * production build can never be talked into calling an internal address.
 */
function privateAddressesAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.LAVENA_ALLOW_PRIVATE_FETCH === "1";
}

export type SafeResponse = { status: number; body: string };

export class UnsafeUrlError extends Error {
  constructor(readonly reason: "scheme" | "credentials" | "address" | "host") {
    super(`unsafe_url:${reason}`);
  }
}

export class FetchFailure extends Error {
  constructor(readonly code: "timeout" | "too_large" | "network") {
    super(code);
  }
}

/** True for an address that belongs to the public internet. */
export function isPublicIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isPublicV4(address);
  if (family === 6) return isPublicV6(address);
  return false;
}

function isPublicV4(address: string) {
  const [a, b, c] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast and reserved
  return true;
}

function isPublicV6(address: string) {
  const lower = address.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicV4(mapped[1]);
  if (lower === "::" || lower === "::1") return false;
  if (/^f[cd]/.test(lower)) return false; // unique local
  if (/^fe[89ab]/.test(lower)) return false; // link-local
  if (lower.startsWith("ff")) return false; // multicast
  if (lower.startsWith("2001:db8")) return false; // documentation
  if (lower.startsWith("64:ff9b")) return false; // NAT64
  return true;
}

/** The checks that need no network. Throws `UnsafeUrlError`. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("host");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("scheme");
  if (url.username || url.password) throw new UnsafeUrlError("credentials");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (privateAddressesAllowed()) return url;
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("host");
  }
  if (net.isIP(host) && !isPublicIp(host)) throw new UnsafeUrlError("address");
  return url;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: LookupCallback,
) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, [] as dns.LookupAddress[]);
    const allowed = privateAddressesAllowed()
      ? addresses
      : addresses.filter((entry) => isPublicIp(entry.address));
    if (allowed.length === 0) {
      return callback(
        Object.assign(new Error("blocked_address"), { code: "EBLOCKED" }),
        [] as dns.LookupAddress[],
      );
    }
    if (options.all) return callback(null, allowed);
    return callback(null, allowed[0].address, allowed[0].family);
  });
}

export function safeRequest(
  rawUrl: string,
  init: {
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxBytes?: number;
  },
): Promise<SafeResponse> {
  const url = assertSafeUrl(rawUrl);
  const timeoutMs = init.timeoutMs ?? 10_000;
  const maxBytes = init.maxBytes ?? 1_000_000;

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: init.method,
        headers: {
          ...init.headers,
          ...(init.body !== undefined
            ? { "Content-Length": Buffer.byteLength(init.body).toString() }
            : {}),
        },
        lookup: safeLookup as unknown as net.LookupFunction,
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(new FetchFailure("too_large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", () => reject(new FetchFailure("network")));
      },
    );

    request.on("timeout", () => request.destroy(new FetchFailure("timeout")));
    request.on("error", (error) => {
      if (error instanceof FetchFailure) return reject(error);
      if ((error as NodeJS.ErrnoException).code === "EBLOCKED") {
        return reject(new UnsafeUrlError("address"));
      }
      return reject(new FetchFailure("network"));
    });

    if (init.body !== undefined) request.write(init.body);
    request.end();
  });
}
