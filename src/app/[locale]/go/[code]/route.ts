import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { GROWTH_COOKIE, GROWTH_COOKIE_MAX_AGE } from "@/lib/growth/cookie";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Where a QR code or a shared referral link lands.
 *
 * A route handler rather than a page: there is nothing to render, and a person
 * standing in front of a poster should see the salon, not a redirect screen.
 *
 * The visit is counted on the server, which stores nothing on the device.
 * Crediting a later booking to this code needs the `glowa_ref` cookie, which
 * is optional under the ePrivacy rules: with consent already given it is set
 * here; otherwise the code travels in `?ref=` and the cookie banner sets it
 * if the visitor agrees (lib/actions/consent.ts). Declining costs the salon
 * the attribution, never the visitor the booking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; code: string }> },
) {
  const { locale: rawLocale, code } = await params;
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  // Signed out is the normal case, so this deliberately carries no session.
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("resolve_growth_link", {
    p_code: code,
  });

  const link = data?.[0];
  const requestUrl = new URL(request.url);

  // An unknown, disabled or suspended code goes to search rather than a 404:
  // someone is standing in a salon holding a phone, and a dead end helps
  // nobody. Nothing tells them whether the code ever existed.
  if (error || !link) {
    return NextResponse.redirect(new URL(`/${locale}/search`, requestUrl));
  }

  const destination = new URL(
    link.target === "book"
      ? `/${locale}/business/${link.business_slug}/book`
      : `/${locale}/business/${link.business_slug}`,
    requestUrl,
  );
  if (link.target === "book" && link.service_id) {
    destination.searchParams.set("service", link.service_id);
  }

  const consent = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value);
  if (!consent?.attribution) {
    destination.searchParams.set("ref", code.toLowerCase());
    return NextResponse.redirect(destination);
  }

  const response = NextResponse.redirect(destination);
  response.cookies.set(GROWTH_COOKIE, code.toLowerCase(), {
    maxAge: GROWTH_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    path: "/",
  });
  return response;
}
