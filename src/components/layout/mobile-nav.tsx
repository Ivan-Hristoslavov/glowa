"use client";

import {
  ArrowRight,
  CalendarDays,
  Heart,
  Menu,
  Search,
  Settings,
  Star,
  Store,
  Tag,
  User2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PUBLIC_LINKS = [
  { href: "/search", key: "discover", icon: Search },
  { href: "/for-business", key: "forBusiness", icon: Store },
  { href: "/pricing", key: "pricing", icon: Tag },
] as const;

const ACCOUNT_LINKS = [
  { href: "/bookings", key: "bookings", icon: CalendarDays },
  { href: "/favorites", key: "favorites", icon: Heart },
  { href: "/reviews", key: "reviews", icon: Star },
  { href: "/profile", key: "profile", icon: User2 },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

type NavLink = (typeof PUBLIC_LINKS)[number] | (typeof ACCOUNT_LINKS)[number];

/**
 * Resolves the session in the browser rather than taking it as a prop, so the
 * header that renders it can stay free of cookies and the page can stay
 * cacheable. Until it resolves, only the public links show - which is also
 * what a signed-out visitor sees, so nothing flashes for them.
 */
export function MobileNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getClaims().then(({ data }) => {
      if (active) setIsSignedIn(typeof data?.claims?.sub === "string");
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => setIsSignedIn(Boolean(session?.user)),
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  function group(label: string, links: readonly NavLink[]) {
    return (
      <div>
        <p className="text-muted-foreground px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wider uppercase">
          {label}
        </p>
        <ul className="space-y-0.5">
          {links.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "glowa-focus group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-[0.95rem] font-medium transition-colors",
                    active ? "bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-background",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="flex-1">{t(key)}</span>
                  <ArrowRight
                    className="text-muted-foreground size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full md:hidden"
          aria-label={t("menu")}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[19rem] flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="text-left">
            <GlowaLogo markClassName="size-7" />
          </SheetTitle>
          <SheetDescription className="sr-only">{t("menu")}</SheetDescription>
        </SheetHeader>

        <nav aria-label={t("mainNav")} className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
          {group(t("explore"), PUBLIC_LINKS)}
          {isSignedIn ? group(t("myAccount"), ACCOUNT_LINKS) : null}
        </nav>

        <div className="space-y-3 border-t p-4">
          <div className="bg-muted/60 flex items-center justify-between rounded-2xl px-3 py-1.5">
            <span className="text-muted-foreground text-sm">{t("preferences")}</span>
            <div className="flex items-center gap-0.5">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
          {!isSignedIn ? (
            <div className="grid gap-2">
              <Button asChild className="rounded-full" onClick={() => setOpen(false)}>
                <Link href="/signup">{t("getStarted")}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full"
                onClick={() => setOpen(false)}
              >
                <Link href="/login">{t("login")}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
