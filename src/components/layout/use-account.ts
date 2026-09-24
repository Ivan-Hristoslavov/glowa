"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Dispatch on `window` after signing in or out outside the browser client. */
export const AUTH_CHANGED_EVENT = "glowa:auth-changed";

export type Account = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** An active membership in at least one business. */
  hasBusiness: boolean;
};

/**
 * Who is looking, resolved in the browser so the header that renders it can
 * stay free of cookies and the page stays cacheable.
 *
 * `hasBusiness` is what lets the menu offer the way in to the business app.
 * Without it a salon owner who signed up from "start free" landed on the
 * customer profile with no link anywhere to onboarding or the dashboard.
 */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load(userId: string | null, email: string | null) {
      if (!userId) {
        if (active) {
          setAccount(null);
          setResolved(true);
        }
        return;
      }

      const [{ data: profile }, { count }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("business_members")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", userId)
          .eq("status", "active"),
      ]);

      if (!active) return;
      setAccount({
        name: profile?.full_name ?? null,
        email,
        avatarUrl: profile?.avatar_url ?? null,
        hasBusiness: (count ?? 0) > 0,
      });
      setResolved(true);
    }

    // `getClaims` verifies the JWT signature rather than trusting the stored
    // session, the same rule the server side follows.
    function resolve() {
      supabase.auth.getClaims().then(({ data }) => {
        const claims = data?.claims;
        const userId = typeof claims?.sub === "string" ? claims.sub : null;
        const email = typeof claims?.email === "string" ? claims.email : null;
        void load(userId, email);
      });
    }
    resolve();

    // A server action that signs someone in sets the cookie without the
    // browser client ever hearing about it, so the header kept saying "sign
    // in" after an inline sign-in. The action's caller announces it instead.
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);

    // Signing in or out in another tab should be reflected here too.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "TOKEN_REFRESHED") return;
        void load(session?.user?.id ?? null, session?.user?.email ?? null);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
    };
  }, []);

  return { account, resolved };
}
