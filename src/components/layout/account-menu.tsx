"use client";

import { CalendarDays, Heart, LogOut, Settings, Star, User2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/[locale]/(auth)/actions";

type AccountMenuProps = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const LINKS = [
  { href: "/profile", key: "profile", icon: User2 },
  { href: "/bookings", key: "bookings", icon: CalendarDays },
  { href: "/favorites", key: "favorites", icon: Heart },
  { href: "/reviews", key: "reviews", icon: Star },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function AccountMenu({ name, email, avatarUrl }: AccountMenuProps) {
  const t = useTranslations("nav");
  const auth = useTranslations("auth");
  const initials = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("myAccount")}
        >
          <Avatar className="size-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate text-sm font-medium">{name ?? email}</span>
          {name && email ? (
            <span className="text-muted-foreground block truncate text-xs font-normal">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LINKS.map(({ href, key, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon className="size-4" aria-hidden />
              {t(key)}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          {/* A sign-out has to be a POST, so it goes through the server action
              rather than a link the browser might prefetch. */}
          <form action={signOutAction}>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="size-4" aria-hidden />
              {auth("signOut")}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
