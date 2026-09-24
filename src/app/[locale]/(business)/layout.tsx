import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminNav } from "@/components/admin/admin-nav";
import { BusinessSwitcher } from "@/components/admin/business-switcher";
import { GlowaLogo } from "@/components/brand/glowa-logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  claimPendingInvitations,
  getActiveMembership,
  listMemberships,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export default async function BusinessLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations("admin.nav");
  const statusLabels = await getTranslations("admin.status");

  let [memberships, active] = await Promise.all([
    listMemberships(),
    getActiveMembership(),
  ]);

  // Someone invited after they already had an account would otherwise be sent
  // to onboarding to create a business they do not need. Claim first, ask
  // second.
  if (!active) {
    const claimed = await claimPendingInvitations();
    if (claimed > 0) {
      [memberships, active] = await Promise.all([
        listMemberships(),
        getActiveMembership(),
      ]);
    }
  }

  // The proxy already requires a session; this requires a business.
  if (!active) redirect(`/${locale}/onboarding`);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  const { data: profile } = userId
    ? await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 flex-col border-r lg:flex">
        <div className="border-sidebar-border border-b px-4 py-4">
          <Link href="/" className="glowa-focus mb-3 inline-block rounded-md">
            <GlowaLogo markClassName="size-7" />
          </Link>
          <BusinessSwitcher businesses={memberships} activeId={active.businessId} />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav />
        </div>

        <div className="border-sidebar-border border-t p-3">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link href={`/business/${active.slug}`}>
              <ExternalLink className="size-4" aria-hidden />
              {t("viewPublicPage")}
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border/70 bg-background/80 sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <AdminMobileNav />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{active.name}</p>
              <Badge
                variant={active.status === "active" ? "secondary" : "outline"}
                className="mt-0.5 h-5 px-1.5 text-[0.65rem] font-normal"
              >
                {statusLabels(active.status)}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/">{t("backToSite")}</Link>
            </Button>
            <LocaleSwitcher />
            <ThemeToggle />
            <AccountMenu
              name={profile?.full_name ?? null}
              email={typeof claims?.claims?.email === "string" ? claims.claims.email : null}
              avatarUrl={profile?.avatar_url ?? null}
              hasBusiness
            />
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
