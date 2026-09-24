import {
  ArrowLeft,
  CalendarCheck,
  CalendarHeart,
  Mail,
  Phone,
  Plus,
  Receipt,
  Repeat,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ClientEditor } from "@/components/admin/client-editor";
import { MetricCard } from "@/components/admin/metric-card";
import { Section } from "@/components/common/section";
import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { Badge } from "@/components/ui/badge";
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

type HistoryItem = NonNullable<
  Awaited<ReturnType<typeof getBusinessClient>>
>["appointments"][number];

/** Booked and still ahead - a visit that is coming, not one that happened. */
function isUpcoming(startsAt: string, status: string) {
  return (
    new Date(startsAt).getTime() > Date.now() && (status === "pending" || status === "confirmed")
  );
}

export default async function ClientDetailPage({
  params,
}: PageProps<"/[locale]/dashboard/clients/[clientId]">) {
  const { locale, clientId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.clients");
  const calendar = await getTranslations("admin.calendar");
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
  const dayFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    day: "numeric",
    timeZone: timezone,
  });
  // Bulgarian's CLDR "short" month is a number ("09"), so the date tile
  // takes the first letters of the full name instead: "сеп", "Sep", "sep".
  const monthFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    month: "long",
    timeZone: timezone,
  });

  const name = client.full_name ?? client.email ?? client.phone ?? "—";
  const upcoming = client.appointments
    .filter((appointment) => isUpcoming(appointment.starts_at, appointment.status))
    .reverse();
  const past = client.appointments.filter(
    (appointment) => !isUpcoming(appointment.starts_at, appointment.status),
  );
  const average =
    client.total_visits > 0 ? Math.round(client.total_spend_cents / client.total_visits) : null;

  function row(appointment: HistoryItem) {
    const start = new Date(appointment.starts_at);
    const staff = appointment.staff_profiles;
    return (
      <li key={appointment.id} className="flex items-center gap-4 px-4 py-3">
        <span className="bg-muted flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 leading-none">
          <span className="font-heading text-lg tabular-nums">{dayFormatter.format(start)}</span>
          <span className="text-muted-foreground mt-0.5 text-[0.65rem] uppercase">
            {monthFormatter.format(start).slice(0, 3)}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {pickLocalized(appointment.services?.name, activeLocale) ||
              pickLocalized(appointment.service_name_snapshot, activeLocale)}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {formatTime(appointment.starts_at, { timeZone: timezone, locale: activeLocale })}
            {staff ? ` · ${staff.display_name}` : ""}
          </span>
        </span>
        <AppointmentStatusBadge status={appointment.status} />
        <span className="w-16 text-right text-sm font-medium tabular-nums">
          {formatPrice(appointment.price_cents, appointment.currency, activeLocale)}
        </span>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/clients">
            <ArrowLeft className="size-4" aria-hidden />
            {t("title")}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start gap-4">
          <span
            className="bg-primary/12 text-primary font-heading flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl"
            aria-hidden
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="font-heading text-2xl sm:text-3xl">{name}</h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {client.phone ? (
                <a
                  href={`tel:${client.phone}`}
                  className="hover:text-primary inline-flex items-center gap-1.5 tabular-nums"
                >
                  <Phone className="size-3.5" aria-hidden />
                  {client.phone}
                </a>
              ) : null}
              {client.email ? (
                <a
                  href={`mailto:${client.email}`}
                  className="hover:text-primary inline-flex min-w-0 items-center gap-1.5"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{client.email}</span>
                </a>
              ) : null}
              {client.first_visit_at ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarHeart className="size-3.5" aria-hidden />
                  {t("clientSince", {
                    date: dateFormatter.format(new Date(client.first_visit_at)),
                  })}
                </span>
              ) : null}
            </div>
            {client.tags && client.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {client.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            {client.phone ? (
              <Button asChild variant="outline" className="rounded-full">
                <a href={`tel:${client.phone}`}>
                  <Phone className="size-4" aria-hidden />
                  {t("call")}
                </a>
              </Button>
            ) : null}
            <Button asChild className="rounded-full">
              <Link href="/dashboard/calendar?new=1">
                <Plus className="size-4" aria-hidden />
                {calendar("newAppointment")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Repeat} tone="accent" label={t("visits")} value={String(client.total_visits)} />
        <MetricCard
          icon={Wallet}
          tone="success"
          label={t("spend")}
          value={formatPrice(client.total_spend_cents, currency, activeLocale) ?? "—"}
        />
        <MetricCard
          icon={Receipt}
          label={t("averageTicket")}
          value={average === null ? "—" : (formatPrice(average, currency, activeLocale) ?? "—")}
        />
        <MetricCard
          icon={CalendarCheck}
          label={t("lastVisit")}
          value={
            client.last_visit_at
              ? dateFormatter.format(new Date(client.last_visit_at))
              : t("never")
          }
        />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          {upcoming.length > 0 ? (
            <Section title={t("upcoming")}>
              <ul className="glowa-card divide-border/70 divide-y rounded-2xl">
                {upcoming.map(row)}
              </ul>
            </Section>
          ) : null}

          <Section title={t("history")}>
            {past.length === 0 ? (
              <p className="text-muted-foreground glowa-card rounded-2xl p-6 text-sm">
                {t("noHistory")}
              </p>
            ) : (
              <ul className="glowa-card divide-border/70 divide-y rounded-2xl">{past.map(row)}</ul>
            )}
          </Section>
        </div>

        <aside className="glowa-card space-y-4 rounded-2xl p-5 lg:sticky lg:top-24">
          <div>
            <h2 className="font-heading text-lg">{t("profileCard")}</h2>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="size-3.5" aria-hidden />
              {t("privacyNote")}
            </p>
          </div>
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
        </aside>
      </div>
    </div>
  );
}
