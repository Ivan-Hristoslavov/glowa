import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Every delivery carries `Lavena-Signature: t=<unix seconds>,v1=<hex>` where
 * the hex is HMAC-SHA256 of `<t>.<raw body>` with the endpoint's secret. The
 * receiver recomputes it and rejects an old timestamp, which is what stops a
 * captured request from being replayed later.
 */
export function signWebhook(secret: string, timestamp: number, body: string) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

/** What a receiver does; kept here so the docs and the tests share one truth. */
export function verifyWebhook(
  secret: string,
  header: string,
  body: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = Buffer.from(signWebhook(secret, timestamp, body).split("v1=")[1], "hex");
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
