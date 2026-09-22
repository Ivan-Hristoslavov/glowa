import { Info, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import { getActiveMembership, listPaymentRecords } from "@/lib/queries/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.payments");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function PaymentsPage({
  params,
}: PageProps<"/[locale]/dashboard/payments">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.payments");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const records = await listPaymentRecords(membership.businessId);
  const activeLocale = locale as Locale;
  const dateFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>

      {/* Honest about the state of things: the records and the schema exist,
          the provider does not. */}
      <div className="border-border/70 bg-secondary/40 rounded-xl border p-4">
        <p className="flex items-start gap-2 text-sm font-medium">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("providerTitle")}
          <Badge variant="outline" className="ml-1 font-normal">
            {t("notConfigured")}
          </Badge>
        </p>
        <p className="text-muted-foreground mt-2 text-sm">{t("providerBody")}</p>
      </div>

      <Section title={t("title")}>
        {records.length === 0 ? (
          <EmptyState icon={Wallet} title={t("empty")} body={t("emptyBody")} />
        ) : (
          <ul className="glowa-card divide-border/70 divide-y">
            {records.map((record) => (
              <li key={record.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                <span className="text-muted-foreground w-44 text-sm">
                  {dateFormatter.format(new Date(record.created_at))}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {record.appointments?.customer_name ?? "—"}
                </span>
                <Badge variant="outline" className="font-normal">
                  {t(`kind.${record.kind}`)}
                </Badge>
                <Badge variant={record.status === "succeeded" ? "secondary" : "outline"}>
                  {t(`status.${record.status}`)}
                </Badge>
                <span className="font-medium">
                  {formatPrice(record.amount_cents, record.currency, activeLocale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
