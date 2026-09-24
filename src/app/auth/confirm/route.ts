import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation and magic-link landing. Lives outside `[locale]` so the
 * link in an email never depends on the locale routing rules.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Never redirect off-origin based on a query parameter.
  const next =
    safeRedirectPath(searchParams.get("next")) ?? `/${routing.defaultLocale}/profile`;

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(`/${routing.defaultLocale}/login?error=invalid_link`, origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      new URL(`/${routing.defaultLocale}/login?error=invalid_link`, origin),
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
