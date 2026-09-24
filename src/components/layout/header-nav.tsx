"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/search", key: "discover" },
  { href: "/for-business", key: "forBusiness" },
  { href: "/pricing", key: "pricing" },
] as const;

type Highlight = { left: number; width: number } | null;

/**
 * The three places a visitor goes from anywhere. A soft pill follows the
 * pointer from link to link, and the page you are on carries a coral dot -
 * so where you are and where you are about to go never look the same.
 */
export function HeaderNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [highlight, setHighlight] = useState<Highlight>(null);

  return (
    <nav
      aria-label={t("mainNav")}
      className="relative hidden items-center md:flex"
      onMouseLeave={() => setHighlight(null)}
    >
      <span
        aria-hidden
        className={cn(
          "bg-foreground/[0.06] absolute inset-y-0 rounded-full transition-[left,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          highlight ? "opacity-100" : "opacity-0",
        )}
        style={highlight ?? undefined}
      />
      {LINKS.map(({ href, key }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onMouseEnter={(event) =>
              setHighlight({
                left: event.currentTarget.offsetLeft,
                width: event.currentTarget.offsetWidth,
              })
            }
            onFocus={(event) =>
              setHighlight({
                left: event.currentTarget.offsetLeft,
                width: event.currentTarget.offsetWidth,
              })
            }
            onBlur={() => setHighlight(null)}
            className={cn(
              "relative rounded-full px-4 py-2 text-sm font-medium transition-colors outline-none",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(key)}
            <span
              aria-hidden
              className={cn(
                "bg-primary absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full transition-[opacity,scale] duration-300",
                active ? "scale-100 opacity-100" : "scale-0 opacity-0",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
