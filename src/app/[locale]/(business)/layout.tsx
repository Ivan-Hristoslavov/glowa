import { ArrowUpRight, Globe } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminQuickCreate } from "@/components/admin/admin-quick-create";
import { AdminTopbarTitle } from "@/components/admin/admin-topbar-title";
import { BusinessSwitcher } from "@/components/admin/business-switcher";
import { CommandMenu } from "@/components/admin/command-menu";
import { UpcomingStrip } from "@/components/admin/upcoming-strip";
import { GlowaLogo } from "@/components/brand/glowa-logo";
import { AccountMenu } from "@/components/layout/account-menu";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  canManage,
  claimPendingInvitations,
  getActiveMembership,
  listMemberships,
  listUpcomingAppointments,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function BusinessLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations("admin.nav");
  const statusLabels = await getTranslations("admin.status");
  const calendar = await getTranslations("admin.calendar");

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

  const [{ data: profile }, { data: business }, upcoming] = await Promise.all([
    userId
      ? supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("businesses").select("timezone").eq("id", active.businessId).maybeSingle(),
    listUpcomingAppointments(active.businessId),
  ]);

  const isLive = active.status === "active";

  return (
    <div className="bg-sidebar flex min-h-dvh flex-col lg:flex-row">
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col lg:flex">
        <div className="px-4 pt-5 pb-4">
          <Link href="/" className="glowa-focus mb-5 inline-block rounded-md px-1">
            <GlowaLogo markClassName="size-7" />
          </Link>
          <BusinessSwitcher businesses={memberships} activeId={active.businessId} />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <AdminNav />
        </div>

        {/* The salon's shop window, one click away - with its state, so a
            draft is never mistaken for a page customers can already see. */}
        <div className="p-3">
          <Link
            href={`/business/${active.slug}`}
            className="glowa-focus group bg-card hover:shadow-lift flex items-center gap-3 rounded-2xl border p-3 transition-shadow duration-300"
          >
            <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
              <Globe className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t("viewPublicPage")}</span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isLive ? "bg-success" : "bg-warning",
                  )}
                  aria-hidden
                />
                {statusLabels(active.status)}
              </span>
            </span>
            <ArrowUpRight
              className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </Link>
        </div>
      </aside>

      {/* The working surface is a raised sheet on the sidebar's tone, the
          way modern tools separate "where" from "what". */}
      <div className="bg-background flex min-w-0 flex-1 flex-col lg:my-2 lg:mr-2 lg:rounded-3xl lg:border lg:shadow-[var(--shadow-card)]">
        {/* The header and the "next up" strip travel together, so who is
            next is on screen whatever page the owner is on. */}
        <div className="bg-background/85 sticky top-0 z-30 backdrop-blur-xl lg:rounded-t-3xl">
        <header className="flex h-16 items-center justify-between gap-3 border-b px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <AdminMobileNav />
            <AdminTopbarTitle businessName={active.name} />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <CommandMenu businessId={active.businessId} slug={active.slug} />
            {canManage(active.role) ? (
              <AdminQuickCreate label={calendar("newAppointment")} />
            ) : null}
            <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex">
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
        <UpcomingStrip
          businessId={active.businessId}
          timezone={business?.timezone ?? "Europe/Sofia"}
          locale={locale as Locale}
          appointments={upcoming}
        />
        </div>

        <main
          id="main-content"
          // A page can ask for the whole width (the calendar does) by carrying
          // `data-fullwidth`; everything else keeps a readable measure.
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10 has-[[data-fullwidth]]:max-w-none has-[[data-fullwidth]]:py-6 lg:has-[[data-fullwidth]]:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
