import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Request-scoped server client. Create a new one per request - never hoist it
 * into a module-level singleton, which would leak one user's session to the
 * next request under fluid compute.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session on every request.
          }
        },
      },
    },
  );
}

/**
 * The only trustworthy way to identify the caller on the server.
 * `getClaims()` verifies the JWT signature against the project's published
 * keys; `getSession()` does not and must never gate access.
 */
export async function getVerifiedClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  return data?.claims ?? null;
}

export async function getCurrentUserId() {
  const claims = await getVerifiedClaims();
  return typeof claims?.sub === "string" ? claims.sub : null;
}
