import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase auth session and writes the rotated cookies onto the
 * response that next-intl already produced for this request.
 *
 * The response is passed in rather than created here so that the i18n rewrite
 * or redirect survives; recreating `NextResponse.next()` would discard it.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Nothing may run between creating the client and this call: it is what
  // rotates the token, and reordering it causes sporadic logouts.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
