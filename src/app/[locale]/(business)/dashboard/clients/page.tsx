import { Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { emptyStateArt } from "@/lib/brand-assets";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import {
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
  const currency = business?.currency ?? "BGN";
  const dateFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    dateStyle: "medium",
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>

      {/* A plain GET form: the query lives in the URL, so a filtered list is
          shareable and the back button behaves. */}
      <form method="get" role="search">
        <Input
          name="q"
          defaultValue={query}
          placeholder={t("search")}
          aria-label={t("search")}
          className="max-w-md"
        />
      </form>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          image={query ? undefined : emptyStateArt.clients}
          title={query ? t("noResults") : t("empty")}
          body={query ? undefined : t("emptyBody")}
        />
      ) : (
        <ul className="glowa-card divide-border/70 divide-y">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="hover:bg-accent/40 glowa-focus flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {client.full_name ?? client.email ?? client.phone ?? "—"}
                  </span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {client.email ?? client.phone ?? t("guest")}
                  </span>
                </span>

                <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 text-sm">
                  <span>
                    {client.total_visits} {t("visits").toLowerCase()}
                  </span>
                  <span>{formatPrice(client.total_spend_cents, currency, activeLocale)}</span>
                  <span>
                    {client.last_visit_at
                      ? dateFormatter.format(new Date(client.last_visit_at))
                      : t("never")}
                  </span>
                </span>

                {client.consent_marketing ? (
                  <Badge variant="secondary">{t("consentYes")}</Badge>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
