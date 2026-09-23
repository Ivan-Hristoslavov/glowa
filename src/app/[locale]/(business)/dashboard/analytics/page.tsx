import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BarChart } from "@/components/admin/charts/bar-chart";
import { HorizontalBarChart } from "@/components/admin/charts/horizontal-bar-chart";
import { MetricCard } from "@/components/admin/metric-card";
import { EmptyState } from "@/components/common/empty-state";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import {
  getActiveMembership,
  getDashboardMetrics,
  listAppointmentsInRange,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.analytics");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const MONTHS_BACK = 6;

export default async function AnalyticsPage({
  params,
}: PageProps<"/[locale]/dashboard/analytics">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.analytics");
  const dashboard = await getTranslations("admin.dashboard");

  const membership = await getActiveMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("currency, timezone")
    .eq("id", membership.businessId)
    .maybeSingle();

  const currency = business?.currency ?? "EUR";
  const timezone = business?.timezone ?? "Europe/Sofia";
  const activeLocale = locale as Locale;

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Aggregated in TypeScript over a six-month window. Fine at salon volume;
  // if a chain outgrows it, this becomes an RPC (see PROJECT_CONTEXT).
  const [appointments, metrics] = await Promise.all([
    listAppointmentsInRange(membership.businessId, from, to),
    getDashboardMetrics(membership.businessId, from, to),
  ]);

  if (appointments.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        <EmptyState icon={BarChart3} title={t("empty")} body={t("emptyBody")} />
      </div>
    );
  }

  // Axis ticks stay compact; Bulgarian's CLDR abbreviation is the month number,
  // which is correct but ambiguous across a year boundary - so the heading
  // above the charts carries the year instead of every tick.
  const monthFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    month: "short",
    timeZone: timezone,
  });
  const rangeFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });

  const monthKeys = Array.from({ length: MONTHS_BACK }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth() + index, 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, date };
  });

  const revenueByMonth = new Map(monthKeys.map((month) => [month.key, 0]));
  const bookingsByMonth = new Map(monthKeys.map((month) => [month.key, 0]));
  const byService = new Map<string, number>();
  const byStaff = new Map<string, number>();

  // "New" means the client's first appointment at this business falls in the
  // month; anyone seen earlier counts as returning.
  const firstSeen = new Map<string, number>();
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  for (const appointment of sorted) {
    const identity = appointment.customer_profile_id ?? appointment.customer_email;
    if (!identity) continue;
    if (!firstSeen.has(identity)) {
      firstSeen.set(identity, new Date(appointment.starts_at).getTime());
    }
  }

  const newByMonth = new Map(monthKeys.map((month) => [month.key, 0]));
  const returningByMonth = new Map(monthKeys.map((month) => [month.key, 0]));
  const countedPerMonth = new Set<string>();

  for (const appointment of sorted) {
    const date = new Date(appointment.starts_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!revenueByMonth.has(key)) continue;

    if (appointment.status === "completed") {
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + appointment.price_cents);
    }
    if (appointment.status !== "cancelled") {
      bookingsByMonth.set(key, (bookingsByMonth.get(key) ?? 0) + 1);

      const serviceName =
        pickLocalized(appointment.services?.name, activeLocale) ||
        pickLocalized(appointment.service_name_snapshot, activeLocale) ||
        "—";
      byService.set(serviceName, (byService.get(serviceName) ?? 0) + 1);

      if (appointment.staff_profiles) {
        const name = appointment.staff_profiles.display_name;
        const minutes =
          (new Date(appointment.ends_at).getTime() - date.getTime()) / 60000;
        byStaff.set(name, (byStaff.get(name) ?? 0) + minutes);
      }
    }

    const identity = appointment.customer_profile_id ?? appointment.customer_email;
    if (!identity) continue;
    const monthIdentity = `${key}:${identity}`;
    if (countedPerMonth.has(monthIdentity)) continue;
    countedPerMonth.add(monthIdentity);

    const first = firstSeen.get(identity) ?? date.getTime();
    const firstDate = new Date(first);
    const isNew =
      firstDate.getFullYear() === date.getFullYear() &&
      firstDate.getMonth() === date.getMonth();

    if (isNew) newByMonth.set(key, (newByMonth.get(key) ?? 0) + 1);
    else returningByMonth.set(key, (returningByMonth.get(key) ?? 0) + 1);
  }

  const topServices = [...byService.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value, display: String(value) }));

  const staffLoad = [...byStaff.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, minutes]) => ({
      label,
      value: minutes,
      display: `${Math.round(minutes / 60)} ${t("hours")}`,
    }));

  const utilisation =
    metrics && metrics.capacity_minutes > 0
      ? Math.round((metrics.booked_minutes / metrics.capacity_minutes) * 100)
      : null;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {rangeFormatter.format(from)} – {rangeFormatter.format(now)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={t("revenue")}
          value={
            formatPrice(Number(metrics?.completed_revenue_cents ?? 0), currency, activeLocale) ??
            "—"
          }
        />
        <MetricCard
          label={t("appointments")}
          value={String(metrics?.appointments_total ?? 0)}
        />
        <MetricCard
          label={t("utilization")}
          value={utilisation === null ? "—" : `${utilisation}%`}
          hint={dashboard("capacity", {
            hours: Math.round((metrics?.capacity_minutes ?? 0) / 60),
          })}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BarChart
          title={t("revenue")}
          series={[{ key: "revenue", label: t("revenue"), color: "var(--viz-series-1)" }]}
          points={monthKeys.map((month) => {
            const cents = revenueByMonth.get(month.key) ?? 0;
            return {
              label: monthFormatter.format(month.date),
              values: [cents / 100],
              display: [formatPrice(cents, currency, activeLocale) ?? "0"],
            };
          })}
        />

        <BarChart
          title={t("retention")}
          series={[
            { key: "new", label: t("new"), color: "var(--viz-series-1)" },
            { key: "returning", label: t("returning"), color: "var(--viz-series-2)" },
          ]}
          points={monthKeys.map((month) => ({
            label: monthFormatter.format(month.date),
            values: [newByMonth.get(month.key) ?? 0, returningByMonth.get(month.key) ?? 0],
            display: [
              String(newByMonth.get(month.key) ?? 0),
              String(returningByMonth.get(month.key) ?? 0),
            ],
          }))}
        />

        <HorizontalBarChart title={t("topServices")} rows={topServices} />

        <HorizontalBarChart
          title={t("topStaff")}
          rows={staffLoad}
          color="var(--viz-series-2)"
        />
      </div>
    </div>
  );
}
