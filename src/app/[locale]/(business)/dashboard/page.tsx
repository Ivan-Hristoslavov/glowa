import {
  CalendarCheck,
  CalendarDays,
  CircleSlash,
  Coins,
  Star,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MetricCard } from "@/components/admin/metric-card";
import { PublishBusinessButton } from "@/components/admin/publish-business-button";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/section";
import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice, formatTime } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import {
  getActiveMembership,
  getDashboardMetrics,
  listAppointmentsInRange,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dashboard");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Start and end of the local day in the salon's timezone, as instants. */
function dayBounds(timezone: string) {
  const now = new Date();
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // `new Date("YYYY-MM-DD")` is UTC midnight; shift it by the zone's offset.
  const utcMidnight = new Date(`${key}T00:00:00Z`);
  const offsetMinutes =
    (new Date(utcMidnight.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
      new Date(utcMidnight.toLocaleString("en-US", { timeZone: timezone })).getTime()) /
    60_000;

  const start = new Date(utcMidnight.getTime() + offsetMinutes * 60_000);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  return { start, end };
}

export default async function DashboardPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.dashboard");
  const nav = await getTranslations("admin.nav");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("timezone, currency, status")
    .eq("id", membership.businessId)
    .maybeSingle();

  const timezone = business?.timezone ?? "Europe/Sofia";
  const currency = business?.currency ?? "BGN";
  const activeLocale = locale as Locale;

  const { start, end } = dayBounds(timezone);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);

  const [metrics, today] = await Promise.all([
    getDashboardMetrics(membership.businessId, monthStart, monthEnd),
    listAppointmentsInRange(membership.businessId, start, end),
  ]);

  const capacityHours = Math.round((metrics?.capacity_minutes ?? 0) / 60);
  const utilisation =
    metrics && metrics.capacity_minutes > 0
      ? Math.round((metrics.booked_minutes / metrics.capacity_minutes) * 100)
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("greeting", { name: membership.name })}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/calendar">
            <CalendarDays className="size-4" aria-hidden />
            {t("viewCalendar")}
          </Link>
        </Button>
      </div>

      {business?.status === "draft" ? (
        <Alert>
          <CalendarCheck className="size-4" aria-hidden />
          <AlertTitle>{t("draftTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t("draftBody")}</p>
            <PublishBusinessButton businessId={membership.businessId} />
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("appointments")}
          value={String(metrics?.appointments_total ?? 0)}
          hint={`${metrics?.appointments_completed ?? 0} ${t("completed").toLowerCase()}`}
          icon={CalendarDays}
        />
        <MetricCard
          label={t("expectedRevenue")}
          value={formatPrice(Number(metrics?.expected_revenue_cents ?? 0), currency, activeLocale) ?? "—"}
          hint={`${formatPrice(Number(metrics?.completed_revenue_cents ?? 0), currency, activeLocale)} ${t("completedRevenue").toLowerCase()}`}
          icon={Coins}
        />
        <MetricCard
          label={t("utilization")}
          value={utilisation === null ? "—" : `${utilisation}%`}
          hint={t("capacity", { hours: capacityHours })}
          icon={TrendingUp}
        />
        <MetricCard
          label={t("rating")}
          value={metrics?.average_rating ? Number(metrics.average_rating).toFixed(1) : "—"}
          hint={`${metrics?.review_count ?? 0} ${t("reviews")}`}
          icon={Star}
        />
        <MetricCard
          label={t("newClients")}
          value={String(metrics?.new_clients ?? 0)}
          icon={UserPlus}
        />
        <MetricCard
          label={t("returningClients")}
          value={String(metrics?.returning_clients ?? 0)}
          icon={Users}
        />
        <MetricCard
          label={t("cancelled")}
          value={String(metrics?.appointments_cancelled ?? 0)}
          icon={CircleSlash}
        />
        <MetricCard
          label={t("noShows")}
          value={String(metrics?.appointments_no_show ?? 0)}
          icon={CircleSlash}
          tone={(metrics?.appointments_no_show ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      {(metrics?.unanswered_reviews ?? 0) > 0 ? (
        <Section title={t("attention")}>
          <Link
            href="/dashboard/reviews"
            className="glowa-card glowa-focus hover:shadow-lift flex items-center gap-4 p-4 transition-shadow"
          >
            <span className="bg-secondary text-primary flex size-10 items-center justify-center rounded-full">
              <Star className="size-5" aria-hidden />
            </span>
            <span>
              <span className="font-heading block text-lg leading-none">
                {metrics?.unanswered_reviews}
              </span>
              <span className="text-muted-foreground block text-sm">
                {t("unansweredReviews")}
              </span>
            </span>
          </Link>
        </Section>
      ) : null}

      <Section
        title={t("todaySchedule")}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/calendar">{nav("calendar")}</Link>
          </Button>
        }
      >
        {today.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("noToday")} body={t("noTodayBody")} />
        ) : (
          <ul className="divide-border/70 glowa-card divide-y">
            {today.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
              >
                <span className="font-heading w-16 text-base">
                  {formatTime(appointment.starts_at, { timeZone: timezone, locale: activeLocale })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {pickLocalized(appointment.services?.name, activeLocale) ||
                      pickLocalized(appointment.service_name_snapshot, activeLocale)}
                  </span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {appointment.customer_name ?? "—"}
                    {appointment.staff_profiles
                      ? ` · ${appointment.staff_profiles.display_name}`
                      : null}
                  </span>
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
