import { getTranslations } from "next-intl/server";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getVerifiedClaims } from "@/lib/supabase/server";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const claims = await getVerifiedClaims();
  const isSignedIn = Boolean(claims?.sub);

  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="glowa-focus rounded-md" aria-label="glowa">
          <GlowaLogo />
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          {isSignedIn ? (
            <Button asChild size="sm">
              <Link href="/profile">{t("profile")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">{t("getStarted")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
