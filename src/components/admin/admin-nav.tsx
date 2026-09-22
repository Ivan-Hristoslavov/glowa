"use client";

import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Scissors,
  Settings,
  Sparkles,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const ADMIN_LINKS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/calendar", key: "calendar", icon: CalendarDays },
  { href: "/dashboard/clients", key: "clients", icon: Users },
  { href: "/dashboard/services", key: "services", icon: Scissors },
  { href: "/dashboard/staff", key: "staff", icon: Sparkles },
  { href: "/dashboard/reviews", key: "reviews", icon: Star },
  { href: "/dashboard/payments", key: "payments", icon: Wallet },
  { href: "/dashboard/marketing", key: "marketing", icon: Megaphone },
  { href: "/dashboard/analytics", key: "analytics", icon: BarChart3 },
  { href: "/dashboard/assistant", key: "assistant", icon: MessageSquareText },
  { href: "/dashboard/settings", key: "settings", icon: Settings },
] as const;

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {ADMIN_LINKS.map(({ href, key, icon: Icon }) => {
        // `/dashboard` must not light up for every child route.
        const isActive =
          href === "/dashboard" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "glowa-focus flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4", isActive && "text-primary")} aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
