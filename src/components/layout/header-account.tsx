"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/layout/account-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type Account = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

/**
 * The only part of the header that depends on who is looking.
 *
 * It lives in the browser on purpose. Reading the session on the server made
 * every marketing page dynamic - the landing page, search and each salon page
 * were re-rendered per request and could never be served from a CDN, which is
 * the difference between competing on speed and not. The cost is that the
 * signed-in state appears a moment after paint; the account area reserves its
 * space so nothing shifts when it does.
 */
export function HeaderAccount() {
  const t = useTranslations("nav");
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

      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;
      setAccount({
        name: data?.full_name ?? null,
        email,
        avatarUrl: data?.avatar_url ?? null,
      });
      setResolved(true);
    }

    // `getClaims` verifies the JWT signature rather than trusting the stored
    // session, the same rule the server side follows.
    supabase.auth.getClaims().then(({ data }) => {
      const claims = data?.claims;
      const userId = typeof claims?.sub === "string" ? claims.sub : null;
      const email = typeof claims?.email === "string" ? claims.email : null;
      void load(userId, email);
    });

    // Signing in or out in another tab should be reflected here too.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void load(session?.user?.id ?? null, session?.user?.email ?? null);
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (!resolved) {
    // Reserves the width of the widest state so the header does not jump.
    return <div className="h-9 w-9 sm:w-[11.5rem]" aria-hidden />;
  }

  if (account) {
    return (
      <AccountMenu
        name={account.name}
        email={account.email}
        avatarUrl={account.avatarUrl}
      />
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="hidden rounded-full sm:inline-flex">
        <Link href="/login">{t("login")}</Link>
      </Button>
      <Button
        asChild
        size="sm"
        className="hidden rounded-full px-4 shadow-[0_8px_24px_-10px_var(--primary)] transition-transform hover:-translate-y-px sm:inline-flex"
      >
        <Link href="/signup">{t("getStarted")}</Link>
      </Button>
    </>
  );
}
