import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv, requireServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses RLS entirely, so it is `server-only` and must
 * be used exclusively for operations that genuinely cannot be expressed as a
 * policy (webhooks, scheduled jobs, cross-tenant admin tooling). Every call
 * site is responsible for its own authorization check.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
