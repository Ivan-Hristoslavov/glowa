import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  let profile: { full_name: string | null; avatar_url: string | null } | null = null;
  if (userId) {
    const { data: row } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    profile = row;
  }

  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="glowa-focus rounded-md" aria-label="glowa">
            <GlowaLogo />
          </Link>
          <nav className="hidden sm:block">
            <Link
              href="/search"
              className="text-muted-foreground hover:text-foreground glowa-focus inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <Search className="size-4" aria-hidden />
              {t("discover")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          {userId ? (
            <AccountMenu
              name={profile?.full_name ?? null}
              email={typeof claims?.email === "string" ? claims.email : null}
              avatarUrl={profile?.avatar_url ?? null}
            />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/signup">{t("getStarted")}</Link>
              </Button>
            </>
          )}
          <MobileNav isSignedIn={Boolean(userId)} />
        </div>
      </div>
    </header>
  );
}
