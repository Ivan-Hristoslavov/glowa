import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ClientEditor } from "@/components/admin/client-editor";
import { MetricCard } from "@/components/admin/metric-card";
import { Section } from "@/components/common/section";
import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { formatPrice, formatTime } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import {
  canManage,
  getActiveMembership,
  getBusinessClient,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.clients");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ClientDetailPage({
  params,
}: PageProps<"/[locale]/dashboard/clients/[clientId]">) {
  const { locale, clientId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.clients");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const client = await getBusinessClient(membership.businessId, clientId);
  if (!client) notFound();

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("currency, timezone")
    .eq("id", membership.businessId)
    .maybeSingle();

  const activeLocale = locale as Locale;
  const currency = business?.currency ?? "EUR";
  const timezone = business?.timezone ?? "Europe/Sofia";
  const dateFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    dateStyle: "medium",
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/clients">
            <ArrowLeft className="size-4" aria-hidden />
            {t("title")}
          </Link>
        </Button>
        <h1 className="font-heading text-2xl sm:text-3xl">
          {client.full_name ?? client.email ?? client.phone ?? "—"}
        </h1>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" aria-hidden />
          {t("privacyNote")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label={t("visits")} value={String(client.total_visits)} />
        <MetricCard
          label={t("spend")}
          value={formatPrice(client.total_spend_cents, currency, activeLocale) ?? "—"}
        />
        <MetricCard
          label={t("firstVisit")}
          value={
            client.first_visit_at
              ? dateFormatter.format(new Date(client.first_visit_at))
              : t("never")
          }
        />
        <MetricCard
          label={t("lastVisit")}
          value={
            client.last_visit_at
              ? dateFormatter.format(new Date(client.last_visit_at))
              : t("never")
          }
        />
      </div>

      <Section title={t("notes")}>
        <ClientEditor
          businessId={membership.businessId}
          canEdit={canManage(membership.role)}
          client={{
            id: client.id,
            fullName: client.full_name ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            notes: client.notes ?? "",
            tags: client.tags ?? [],
            consentMarketing: client.consent_marketing,
          }}
        />
      </Section>

      <Section title={t("history")}>
        {client.appointments.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noHistory")}</p>
        ) : (
          <ul className="glowa-card divide-border/70 divide-y">
            {client.appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4"
              >
                <span className="text-muted-foreground w-36 text-sm">
                  {dateFormatter.format(new Date(appointment.starts_at))}
                  {" · "}
                  {formatTime(appointment.starts_at, {
                    timeZone: timezone,
                    locale: activeLocale,
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {pickLocalized(appointment.services?.name, activeLocale) ||
                    pickLocalized(appointment.service_name_snapshot, activeLocale)}
                </span>
                <AppointmentStatusBadge status={appointment.status} />
                <span className="text-muted-foreground text-sm">
                  {formatPrice(appointment.price_cents, appointment.currency, activeLocale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
