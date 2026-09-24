import { Download, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { emptyStateArt } from "@/lib/brand-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import {
  canManage,
  getActiveMembership,
  listBusinessClients,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.clients");
  return { title: t("title"), robots: { index: false, follow: false } };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClientsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/clients">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.clients");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const sp = await searchParams;
  const query = firstParam(sp.q) ?? "";

  const supabase = await createClient();
  const [{ data: business }, clients] = await Promise.all([
    supabase
      .from("businesses")
      .select("currency")
      .eq("id", membership.businessId)
      .maybeSingle(),
    listBusinessClients(membership.businessId, query),
  ]);

  const activeLocale = locale as Locale;
  const currency = business?.currency ?? "EUR";
  const dateFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    dateStyle: "medium",
  });

  const returning = clients.filter((client) => client.total_visits > 1).length;
  const marketable = clients.filter((client) => client.consent_marketing).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="bg-card rounded-full border px-3 py-1.5">
              <span className="font-semibold tabular-nums">{clients.length}</span>{" "}
              <span className="text-muted-foreground">{t("countTotal")}</span>
            </span>
            <span className="bg-card rounded-full border px-3 py-1.5">
              <span className="font-semibold tabular-nums">{returning}</span>{" "}
              <span className="text-muted-foreground">{t("countReturning")}</span>
            </span>
            <span className="bg-card rounded-full border px-3 py-1.5">
              <span className="font-semibold tabular-nums">{marketable}</span>{" "}
              <span className="text-muted-foreground">{t("countConsent")}</span>
            </span>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
      {/* A plain GET form: the query lives in the URL, so a filtered list is
          shareable and the back button behaves. */}
      <form method="get" role="search" className="relative w-full max-w-md">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          name="q"
          defaultValue={query}
          placeholder={t("search")}
          aria-label={t("search")}
          className="bg-card h-11 rounded-full pl-10"
        />
      </form>
      {canManage(membership.role) && clients.length > 0 ? (
        // A plain link: the browser handles the download, no client JS.
        <Button asChild variant="outline" className="rounded-full">
          <a href="/api/business/clients/export" download>
            <Download className="size-4" aria-hidden />
            {t("export")}
          </a>
        </Button>
      ) : null}
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          art={query ? undefined : emptyStateArt.clients}
          title={query ? t("noResults") : t("empty")}
          body={query ? undefined : t("emptyBody")}
        />
      ) : (
        <div className="glowa-card overflow-hidden rounded-2xl">
          <div className="text-muted-foreground bg-muted/40 hidden grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_6rem] gap-4 border-b px-5 py-3 text-xs font-medium tracking-wide uppercase md:grid">
            <span>{t("client")}</span>
            <span className="text-right">{t("visits")}</span>
            <span className="text-right">{t("spend")}</span>
            <span className="text-right">{t("lastVisit")}</span>
            <span />
          </div>
          <ul className="divide-y">
            {clients.map((client) => {
              const name = client.full_name ?? client.email ?? client.phone ?? "—";
              const initials = name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join("")
                .toUpperCase();
              return (
                <li key={client.id}>
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="hover:bg-muted/40 glowa-focus grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 transition-colors md:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))_6rem]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                        {initials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="text-muted-foreground block truncate text-sm">
                          {client.email ?? client.phone ?? t("guest")}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums md:block">
                      <span className="font-medium">{client.total_visits}</span>
                      <span className="text-muted-foreground md:hidden"> · {t("visits").toLowerCase()}</span>
                    </span>
                    <span className="hidden text-right text-sm font-medium tabular-nums md:block">
                      {formatPrice(client.total_spend_cents, currency, activeLocale)}
                    </span>
                    <span className="text-muted-foreground hidden text-right text-sm md:block">
                      {client.last_visit_at
                        ? dateFormatter.format(new Date(client.last_visit_at))
                        : t("never")}
                    </span>
                    <span className="hidden justify-end md:flex">
                      {client.consent_marketing ? (
                        <Badge variant="secondary" className="font-normal">
                          {t("consentShort")}
                        </Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
