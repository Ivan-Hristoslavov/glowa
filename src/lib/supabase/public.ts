import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Anonymous, cookie-less client for genuinely public reads - the sitemap and
 * anything else that must not vary by visitor.
 *
 * The request-scoped client in `server.ts` reads cookies, which makes its
 * caller dynamic and would tie a cached artefact to whoever happened to
 * request it first. This one carries no session at all, so `anon` RLS is the
 * only thing deciding what comes back.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
