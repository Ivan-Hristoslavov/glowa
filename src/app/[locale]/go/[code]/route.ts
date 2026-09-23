import { NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Where a QR code or a shared referral link lands.
 *
 * A route handler rather than a page: there is nothing to render, and a person
 * standing in front of a poster should see the salon, not a redirect screen.
 *
 * The cookie is the only thing GLOWA remembers about the visit. It is not an
 * identifier - it holds the link code and nothing else, so the booking that
 * may follow can be credited to the right poster. Thirty days is long enough
 * for "I'll book later tonight" and short enough not to be a tracker.
 */
export const GROWTH_COOKIE = "glowa_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function GET(
  request: Request,
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

  const response = NextResponse.redirect(destination);
  response.cookies.set(GROWTH_COOKIE, code.toLowerCase(), {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    path: "/",
  });
  return response;
}
