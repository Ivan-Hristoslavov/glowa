"use client";

import {
  CalendarDays,
  Heart,
  Menu,
  Search,
  Settings,
  Star,
  Tag,
  User2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

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

  const links = isSignedIn ? [...PUBLIC_LINKS, ...ACCOUNT_LINKS] : PUBLIC_LINKS;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label={t("menu")}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[17rem] p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-left">
            <GlowaLogo markClassName="size-7" />
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col p-2">
          {links.map(({ href, key, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="hover:bg-accent focus-visible:ring-ring/60 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Icon className="text-muted-foreground size-4" aria-hidden />
              {t(key)}
            </Link>
          ))}
        </nav>

        {!isSignedIn ? (
          <div className="flex flex-col gap-2 border-t p-4">
            <Button asChild variant="outline" onClick={() => setOpen(false)}>
              <Link href="/login">{t("login")}</Link>
            </Button>
            <Button asChild onClick={() => setOpen(false)}>
              <Link href="/signup">{t("getStarted")}</Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
