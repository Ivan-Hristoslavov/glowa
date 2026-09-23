import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { HeaderAccount } from "@/components/layout/header-account";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";

/**
 * Deliberately reads no cookies.
 *
 * It used to resolve the session here, which made every page that renders a
 * header dynamic - including the landing page, search and every salon page.
 * Those are the pages that have to be fast and cacheable, so the part that
 * varies per visitor moved into `HeaderAccount`, a client island.
 */
export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="border-border/70 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="glowa-focus rounded-md" aria-label="glowa">
            <GlowaLogo />
          </Link>
          <nav className="hidden items-center gap-5 sm:flex">
            <Link
              href="/search"
              className="text-muted-foreground hover:text-foreground glowa-focus inline-flex items-center gap-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <Search className="size-4" aria-hidden />
              {t("discover")}
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-foreground glowa-focus rounded-md text-sm font-medium transition-colors"
            >
              {t("pricing")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <HeaderAccount />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
