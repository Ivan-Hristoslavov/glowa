"use client";

import {
  ArrowRight,
  CalendarDays,
  Heart,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  Star,
  Store,
  Tag,
  User2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { useAccount } from "@/components/layout/use-account";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

const PUBLIC_LINKS = [
  { href: "/search", key: "discover", icon: Search },
  { href: "/pricing", key: "pricing", icon: Tag },
] as const;

const ACCOUNT_LINKS = [
  { href: "/profile", key: "profile", icon: User2 },
  { href: "/bookings", key: "bookings", icon: CalendarDays },
  { href: "/favorites", key: "favorites", icon: Heart },
  { href: "/reviews", key: "reviews", icon: Star },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

/**
 * Resolves the session in the browser rather than taking it as a prop, so the
 * header that renders it can stay free of cookies and the page can stay
 * cacheable. Until it resolves, only the public links show - which is also
 * what a signed-out visitor sees, so nothing flashes for them.
 */
export function MobileNav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { account } = useAccount();

  const links = account ? [...PUBLIC_LINKS, ...ACCOUNT_LINKS] : PUBLIC_LINKS;
  const linkClass =
    "hover:bg-accent focus-visible:ring-ring/60 flex items-center gap-3 rounded-xl px-3 py-3 text-[0.95rem] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label={t("menu")}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[18rem] flex-col p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-left">
            <GlowaLogo markClassName="size-7" />
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-0.5 p-2">
          {links.map(({ href, key, icon: Icon }, index) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`${linkClass} animate-in fade-in slide-in-from-right-3 fill-mode-both`}
              style={{ animationDelay: `${60 + index * 35}ms`, animationDuration: "400ms" }}
            >
              <Icon className="text-muted-foreground size-4" aria-hidden />
              {t(key)}
            </Link>
          ))}
          {account ? (
            <Link
              href={account.hasBusiness ? "/dashboard" : "/onboarding"}
              onClick={() => setOpen(false)}
              className={`${linkClass} text-primary`}
            >
              {account.hasBusiness ? (
                <LayoutDashboard className="size-4" aria-hidden />
              ) : (
                <Store className="size-4" aria-hidden />
              )}
              {account.hasBusiness ? t("businessDashboard") : t("registerBusiness")}
            </Link>
          ) : null}
        </nav>

        {!account ? (
          <div className="mt-auto flex flex-col gap-2 border-t p-4">
            <Button asChild variant="outline" size="lg" onClick={() => setOpen(false)}>
              <Link href="/login">{t("login")}</Link>
            </Button>
            <Button asChild size="lg" onClick={() => setOpen(false)}>
              <Link href={`/signup?next=${encodeURIComponent(`/${locale}/onboarding`)}`}>
                {t("forBusiness")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
