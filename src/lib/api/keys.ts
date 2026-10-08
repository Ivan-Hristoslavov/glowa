import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const API_KEY_SCOPES = ["read", "bookings", "catalog"] as const;
export type ApiScope = (typeof API_KEY_SCOPES)[number];

const PREFIX = "lv_live_";

/** A new key. The plain text is shown once and never stored. */
export function generateApiKey() {
  const secret = randomBytes(24).toString("base64url");
  const key = `${PREFIX}${secret}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** The key from `Authorization: Bearer <key>`, or null. */
export function bearerKey(request: Request) {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(lv_live_[A-Za-z0-9_-]{20,64})$/);
  return match ? match[1] : null;
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}
