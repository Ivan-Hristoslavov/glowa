"use client";

import { useTranslations } from "next-intl";

import { activeAdminLink } from "@/components/admin/admin-nav";
import { usePathname } from "@/i18n/navigation";

/**
 * Where you are, in the top bar. The page's own heading says it again below
 * in display type; this is the small orienting label that stays put while
 * the page scrolls under it.
 */
export function AdminTopbarTitle({ businessName }: { businessName: string }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const link = activeAdminLink(pathname);
  const Icon = link?.icon;

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-muted-foreground hidden truncate sm:inline">{businessName}</span>
      {link ? (
        <>
          <span className="text-muted-foreground/60 hidden sm:inline" aria-hidden>
            /
          </span>
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            {Icon ? <Icon className="text-primary size-4 shrink-0" aria-hidden /> : null}
            <span className="truncate">{t(link.key)}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}
