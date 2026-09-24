import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google (or any OAuth provider) sends people back. The browser client
 * started a PKCE flow and left its verifier in a cookie; exchanging the code
 * here sets the session cookies on this response. Outside `[locale]` for the
 * same reason as /auth/confirm: the URL registered with the provider must not
 * depend on the locale.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Never redirect off-origin based on a query parameter.
  const next =
    safeRedirectPath(searchParams.get("next")) ?? `/${routing.defaultLocale}/profile`;
  const locale =
    routing.locales.find((candidate) => next.startsWith(`/${candidate}/`) || next === `/${candidate}`) ??
    routing.defaultLocale;

  if (!code) {
    return NextResponse.redirect(new URL(`/${locale}/login?error=oauth`, origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/${locale}/login?error=oauth`, origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
