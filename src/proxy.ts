import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createIntlMiddleware(routing);

/** Paths (after the locale prefix) that require a signed-in user. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/profile",
  "/bookings",
  "/favorites",
  "/settings",
];

/** Paths a signed-in user should not see. */
const AUTH_ONLY_PREFIXES = ["/login", "/signup"];

function stripLocale(pathname: string) {
  const [, maybeLocale, ...rest] = pathname.split("/");
  const isLocale = (routing.locales as readonly string[]).includes(maybeLocale);
  return {
    locale: isLocale ? maybeLocale : routing.defaultLocale,
    path: isLocale ? `/${rest.join("/")}` : pathname,
  };
}

export async function proxy(request: NextRequest) {
  // i18n first: it owns redirects to the locale-prefixed URL.
  const intlResponse = handleI18nRouting(request);

  const { response, claims } = await updateSession(request, intlResponse);

  // A locale redirect has no page to protect yet; the redirected request
  // comes back through here with the prefix in place.
  if (response.status >= 300 && response.status < 400) {
    return response;
  }

  const { locale, path } = stripLocale(request.nextUrl.pathname);
  const isSignedIn = Boolean(claims?.sub);

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (isSignedIn && AUTH_ONLY_PREFIXES.some((p) => path.startsWith(p))) {
    // Someone already signed in who follows "start free" (next=onboarding) or
    // a sign-in link from a booking should land where the link meant, not on
    // their profile. Same-origin relative paths only, as everywhere else.
    const safeNext = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    const target = new URL(safeNext ?? `/${locale}/profile`, request.nextUrl.origin);
    const url = request.nextUrl.clone();
    url.pathname = target.pathname;
    url.search = target.search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  // Everything except API routes, the locale-free auth handlers, Next
  // internals and files with an extension. `/auth/` was missing: the locale
  // middleware redirected /auth/confirm, /auth/callback and /auth/signout to
  // /bg/auth/..., which does not exist, so every emailed confirmation and
  // password reset link ended on a 404.
  matcher: "/((?!api|auth/|_next|_vercel|.*\\..*).*)",
};
