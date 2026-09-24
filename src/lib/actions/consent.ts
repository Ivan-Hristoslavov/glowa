"use server";

import { cookies } from "next/headers";

import { GROWTH_COOKIE, GROWTH_COOKIE_MAX_AGE } from "@/lib/growth/cookie";
import { CONSENT_COOKIE, GROWTH_CODE_PATTERN, parseConsent } from "@/lib/consent";

/**
 * Remembers which QR code or referral link brought this visitor - but only
 * once they have agreed to it. The /go route cannot set the cookie for a
 * first-time visitor (no choice has been made yet), so it passes the code in
 * the URL and the banner calls this after "accept". The consent cookie is
 * read here rather than trusted from the caller.
 */
export async function rememberReferral(code: string) {
  const normalized = code.trim().toLowerCase();
  if (!GROWTH_CODE_PATTERN.test(normalized)) return { ok: false as const };

  const jar = await cookies();
  if (!parseConsent(jar.get(CONSENT_COOKIE)?.value)?.attribution) return { ok: false as const };

  jar.set(GROWTH_COOKIE, normalized, {
    maxAge: GROWTH_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return { ok: true as const };
}

/** Withdrawing consent removes what it allowed. The cookie is httpOnly. */
export async function forgetReferral() {
  const jar = await cookies();
  jar.delete(GROWTH_COOKIE);
  return { ok: true as const };
}
