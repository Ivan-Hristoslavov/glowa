"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

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
import { Link, useRouter } from "@/i18n/navigation";
import { setActiveBusiness } from "@/lib/actions/business";
import { cn } from "@/lib/utils";

type SwitcherBusiness = {
  businessId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: string;
};

export function BusinessSwitcher({
  businesses,
  activeId,
}: {
  businesses: SwitcherBusiness[];
  activeId: string;
}) {
  const t = useTranslations("admin.nav");
  const roles = useTranslations("admin.staff.role");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const active = businesses.find((item) => item.businessId === activeId);

  function select(businessId: string) {
    if (businessId === activeId) return;
    startTransition(async () => {
      await setActiveBusiness(businessId);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={isPending}
          className="bg-card hover:bg-card h-auto w-full justify-between rounded-2xl border px-2.5 py-2.5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)]"
          aria-label={t("switchBusiness")}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-9 rounded-xl">
              {active?.logoUrl ? <AvatarImage src={active.logoUrl} alt="" /> : null}
              <AvatarFallback className="from-primary to-brand-soft text-primary-foreground rounded-xl bg-gradient-to-br text-sm font-semibold">
                {active?.name.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{active?.name}</span>
              <span className="text-muted-foreground block truncate text-xs font-normal">
                {active ? roles(active.role as "owner") : null}
              </span>
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("switchBusiness")}</DropdownMenuLabel>
        {businesses.map((item) => (
          <DropdownMenuItem key={item.businessId} onClick={() => select(item.businessId)}>
            <Check
              className={cn(
                "size-4",
                item.businessId === activeId ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
            <span className="truncate">{item.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus className="size-4" aria-hidden />
            {t("workspace")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
