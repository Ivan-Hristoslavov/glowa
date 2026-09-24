import { GlowaLogo } from "@/components/brand/glowa-logo";
import { HeaderAccount } from "@/components/layout/header-account";
import { HeaderFrame } from "@/components/layout/header-frame";
import { HeaderNav } from "@/components/layout/header-nav";
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
 * varies per visitor moved into `HeaderAccount`, a client island, and the
 * parts that react to scroll and route into `HeaderFrame` and `HeaderNav`.
 */
export function SiteHeader() {
  return (
    <HeaderFrame>
      <div className="flex flex-1 items-center">
        <Link
          href="/"
          className="glowa-focus rounded-full transition-transform duration-300 hover:scale-[1.03]"
          aria-label="glowa"
        >
          <GlowaLogo markClassName="size-7" />
        </Link>
      </div>

      <HeaderNav />

      <div className="flex flex-1 items-center justify-end gap-0.5 sm:gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
        <HeaderAccount />
        <MobileNav />
      </div>
    </HeaderFrame>
  );
}
