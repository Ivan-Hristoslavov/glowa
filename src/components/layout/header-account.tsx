"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AccountMenu } from "@/components/layout/account-menu";
import { NextVisitPill } from "@/components/layout/next-visit-pill";
import { useAccount } from "@/components/layout/use-account";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

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
  const locale = useLocale();
  const { account, resolved } = useAccount();

  if (!resolved) {
    // Reserves the width of the widest state so the header does not jump.
    return <div className="h-9 w-9 sm:w-[11.5rem]" aria-hidden />;
  }

  if (account) {
    return (
      <>
        {account.nextVisit ? <NextVisitPill visit={account.nextVisit} /> : null}
        <AccountMenu
          name={account.name}
          email={account.email}
          avatarUrl={account.avatarUrl}
          hasBusiness={account.hasBusiness}
        />
      </>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/login">{t("login")}</Link>
      </Button>
      {/* Customers create an account where they need one - at the end of a
          booking. This button is for the other audience: salons. */}
      <Button asChild size="sm" className="group hidden sm:inline-flex">
        <Link href={`/signup?next=${encodeURIComponent(`/${locale}/onboarding`)}`}>
          {t("forBusiness")}
          <ArrowRight
            className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </Button>
    </>
  );
}
