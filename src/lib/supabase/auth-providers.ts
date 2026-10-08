import "server-only";

import { publicEnv } from "@/lib/env";

/**
 * Which sign-in providers the Supabase project has switched on, read from
 * its public `/auth/v1/settings`. The "Continue with Google" and "Continue with
 * Apple" buttons appear by themselves once the provider is enabled in the dashboard - no second flag to keep
 * in sync - and a disabled provider never shows a button that ends on an
 * error page. Cached for an hour; a failure means "email only".
 */
export async function getAuthProviders(): Promise<{ google: boolean; apple: boolean }> {
  try {
    const response = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return { google: false, apple: false };
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return {
      google: settings.external?.google === true,
      apple: settings.external?.apple === true,
    };
  } catch {
    return { google: false, apple: false };
  }
}
