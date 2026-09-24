"use client";

import {
  BarChart3,
  CalendarDays,
  CalendarOff,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  QrCode,
  Scissors,
  Settings,
  Sparkles,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The admin, grouped the way a salon's week is: what happens today, what the
 * salon is made of, and what brings people back. Twelve flat links read as a
 * settings screen; three short groups read as a tool.
 */
export type AdminLink = {
  href: `/dashboard${string}`;
  key:
    | "dashboard"
    | "calendar"
    | "timeOff"
    | "clients"
    | "services"
    | "staff"
    | "payments"
    | "reviews"
    | "marketing"
    | "growth"
    | "analytics"
    | "assistant"
    | "billing"
    | "settings";
  icon: LucideIcon;
};

type AdminGroup = { key: "daily" | "salon" | "growth" | "account"; links: AdminLink[] };

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    key: "daily",
    links: [
      { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
      { href: "/dashboard/calendar", key: "calendar", icon: CalendarDays },
      { href: "/dashboard/time-off", key: "timeOff", icon: CalendarOff },
      { href: "/dashboard/clients", key: "clients", icon: Users },
    ],
  },
  {
    key: "salon",
    links: [
      { href: "/dashboard/services", key: "services", icon: Scissors },
      { href: "/dashboard/staff", key: "staff", icon: Sparkles },
      { href: "/dashboard/payments", key: "payments", icon: Wallet },
    ],
  },
  {
    key: "growth",
    links: [
      { href: "/dashboard/reviews", key: "reviews", icon: Star },
      { href: "/dashboard/marketing", key: "marketing", icon: Megaphone },
      { href: "/dashboard/growth", key: "growth", icon: QrCode },
      { href: "/dashboard/analytics", key: "analytics", icon: BarChart3 },
      { href: "/dashboard/assistant", key: "assistant", icon: MessageSquareText },
    ],
  },
  {
    key: "account",
    links: [
      { href: "/dashboard/billing", key: "billing", icon: CreditCard },
      { href: "/dashboard/settings", key: "settings", icon: Settings },
    ],
  },
];

export const ADMIN_LINKS: AdminLink[] = ADMIN_GROUPS.flatMap((group) => group.links);

/** The link a path belongs to; `/dashboard` must not claim every child. */
export function activeAdminLink(pathname: string): AdminLink | undefined {
  return [...ADMIN_LINKS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((link) =>
      link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href),
    );
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const active = activeAdminLink(pathname);

  return (
    <nav className="flex flex-col gap-5" aria-label={t("menu")}>
      {ADMIN_GROUPS.map((group) => (
        <div key={group.key} className="space-y-1">
          {group.key !== "account" ? (
            <p className="text-muted-foreground/80 px-3 text-[0.68rem] font-medium tracking-[0.14em] uppercase">
              {t(`groups.${group.key}`)}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.links.map(({ href, key, icon: Icon }) => {
              const isActive = active?.href === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "glowa-focus group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-sidebar-accent/80 text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
