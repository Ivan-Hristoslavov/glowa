import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CircleSlash,
  Coins,
  QrCode,
  Scissors,
  ShieldCheck,
  Star,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PublishBusinessButton } from "@/components/admin/publish-business-button";
import { EmptyState } from "@/components/common/empty-state";
import { AppointmentStatusBadge } from "@/components/customer/appointment-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { emptyStateArt } from "@/lib/brand-assets";
import { formatPrice, formatTime } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import {
  getActiveMembership,
  getDashboardMetrics,
  listAppointmentsInRange,
  type AdminAppointment,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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

/** Morning, day or evening at the salon - not wherever the server runs. */
function partOfDay(timezone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: timezone }).format(
      new Date(),
    ),
  );
  if (hour < 12) return "greetingMorning" as const;
  if (hour < 18) return "greetingDay" as const;
  return "greetingEvening" as const;
}

/** The first appointment today that has not started yet. */
function nextUp(appointments: AdminAppointment[]) {
  const now = Date.now();
  return (
    appointments.find(
      (appointment) =>
        new Date(appointment.starts_at).getTime() >= now &&
        (appointment.status === "pending" || appointment.status === "confirmed"),
    ) ?? null
  );
}

function hasEnded(appointment: AdminAppointment) {
  return new Date(appointment.ends_at).getTime() < Date.now();
}

const SECURED = new Set(["paid", "applied", "retained"]);
const TIMELINE_LIMIT = 6;

export default async function DashboardPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.dashboard");
  const nav = await getTranslations("admin.nav");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  const [{ data: business }, { data: profile }] = await Promise.all([
    supabase
      .from("businesses")
      .select("timezone, currency, status, deposits_enabled")
      .eq("id", membership.businessId)
      .maybeSingle(),
    userId
      ? supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const timezone = business?.timezone ?? "Europe/Sofia";
  const currency = business?.currency ?? "EUR";
  const activeLocale = locale as Locale;
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "";

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

  const activeToday = today.filter(
    (appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show",
  );
  const todayRevenue = activeToday.reduce((sum, appointment) => sum + appointment.price_cents, 0);
  const upcoming = nextUp(today);
  // A full day is twenty-odd rows; the dashboard shows what is still ahead,
  // six at a time, and the calendar has the rest.
  const remaining = today.filter((appointment) => !hasEnded(appointment));
  const shown = (remaining.length > 0 ? remaining : today.slice(-3)).slice(0, TIMELINE_LIMIT);
  const hiddenCount = today.length - shown.length;
  const zoned = { timeZone: timezone, locale: activeLocale };
  const dateLine = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).format(start);

  const serviceName = (appointment: AdminAppointment) =>
    pickLocalized(appointment.services?.name, activeLocale) ||
    pickLocalized(appointment.service_name_snapshot, activeLocale);

  const quickActions = [
    { href: "/dashboard/services", label: t("qaService"), icon: Scissors },
    { href: "/dashboard/staff", label: t("qaInvite"), icon: UserPlus },
    { href: "/dashboard/growth", label: t("qaQr"), icon: QrCode },
    ...(business?.deposits_enabled
      ? []
      : [{ href: "/dashboard/payments", label: t("qaDeposits"), icon: Wallet }]),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={dateLine}
        title={firstName ? t(partOfDay(timezone), { name: firstName }) : t("title")}
        description={t("greeting", { name: membership.name })}
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/dashboard/calendar">
              <CalendarDays className="size-4" aria-hidden />
              {t("viewCalendar")}
            </Link>
          </Button>
        }
      />

      {business?.status === "draft" ? (
        <Alert className="rounded-2xl">
          <CalendarCheck className="size-4" aria-hidden />
          <AlertTitle>{t("draftTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <div className="flex items-start gap-4">
              <Image
                src={emptyStateArt.onboarding.light}
                alt=""
                width={72}
                height={72}
                className="hidden size-16 shrink-0 rounded-lg object-cover sm:block"
              />
              <p>{t("draftBody")}</p>
            </div>
            <PublishBusinessButton businessId={membership.businessId} />
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("appointments")}
          value={String(metrics?.appointments_total ?? 0)}
          hint={`${metrics?.appointments_completed ?? 0} ${t("completed").toLowerCase()} · ${t("thisMonth").toLowerCase()}`}
          icon={CalendarDays}
          tone="accent"
        />
        <MetricCard
          label={t("expectedRevenue")}
          value={formatPrice(Number(metrics?.expected_revenue_cents ?? 0), currency, activeLocale) ?? "—"}
          hint={`${formatPrice(Number(metrics?.completed_revenue_cents ?? 0), currency, activeLocale)} ${t("completedRevenue").toLowerCase()}`}
          icon={Coins}
          tone="success"
        />
        <MetricCard
          label={t("utilization")}
          value={utilisation === null ? "—" : `${utilisation}%`}
          hint={t("capacity", { hours: capacityHours })}
          icon={TrendingUp}
          progress={utilisation}
        />
        <MetricCard
          label={t("rating")}
          value={metrics?.average_rating ? Number(metrics.average_rating).toFixed(1) : "—"}
          hint={`${metrics?.review_count ?? 0} ${t("reviews")}`}
          icon={Star}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Today, as a timeline: the one list a salon reads twenty times a day. */}
        <section className="glowa-card rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="font-heading text-xl">{t("todaySchedule")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("todaySummary", {
                  count: activeToday.length,
                  revenue: formatPrice(todayRevenue, currency, activeLocale) ?? "0",
                })}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href="/dashboard/calendar">
                {nav("calendar")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          {today.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={CalendarDays}
                art={emptyStateArt.calendar}
                title={t("noToday")}
                body={t("noTodayBody")}
              />
            </div>
          ) : (
            <ol className="relative px-5 py-3">
              {shown.map((appointment, index) => {
                const color = appointment.staff_profiles?.color ?? "#D96C61";
                const done = hasEnded(appointment);
                const inactive =
                  appointment.status === "cancelled" || appointment.status === "no_show";
                const isNext = upcoming?.id === appointment.id;
                return (
                  <li key={appointment.id} className="relative flex gap-4 py-3">
                    {/* The rail. */}
                    {index < shown.length - 1 ? (
                      <span
                        className="bg-border absolute top-9 bottom-[-0.75rem] left-[4.6rem] w-px"
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        "w-14 shrink-0 pt-0.5 text-right text-sm tabular-nums",
                        isNext ? "text-primary font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {formatTime(appointment.starts_at, zoned)}
                    </span>
                    <span
                      className={cn(
                        "relative z-10 mt-1.5 size-3 shrink-0 rounded-full ring-4",
                        isNext ? "ring-primary/20" : "ring-card",
                      )}
                      style={{ backgroundColor: done || inactive ? "var(--muted-foreground)" : color }}
                      aria-hidden
                    />
                    <div
                      className={cn(
                        "min-w-0 flex-1 rounded-xl border px-4 py-3 transition-colors",
                        isNext ? "border-primary/40 bg-primary/5" : "bg-card",
                        inactive && "opacity-60",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn("truncate font-medium", inactive && "line-through")}>
                            {serviceName(appointment)}
                          </p>
                          <p className="text-muted-foreground truncate text-sm">
                            {appointment.customer_name ?? "—"} ·{" "}
                            {formatTime(appointment.starts_at, zoned)}–
                            {formatTime(appointment.ends_at, zoned)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {SECURED.has(appointment.deposit_status) ? (
                            <ShieldCheck
                              className="text-success size-4"
                              aria-label={t("depositSecured")}
                            />
                          ) : null}
                          <AppointmentStatusBadge status={appointment.status} />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {appointment.staff_profiles ? (
                          <span className="text-muted-foreground flex items-center gap-2 text-xs">
                            <Avatar className="size-5">
                              {appointment.staff_profiles.avatar_url ? (
                                <AvatarImage src={appointment.staff_profiles.avatar_url} alt="" />
                              ) : null}
                              <AvatarFallback
                                className="text-[0.6rem]"
                                style={{ backgroundColor: `${color}22`, color }}
                              >
                                {appointment.staff_profiles.display_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            {appointment.staff_profiles.display_name}
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="text-sm font-medium tabular-nums">
                          {formatPrice(appointment.price_cents, appointment.currency, activeLocale)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
              {hiddenCount > 0 ? (
                <li className="pt-2 pl-[5.5rem]">
                  <Link
                    href="/dashboard/calendar"
                    className="text-primary glowa-focus inline-flex items-center gap-1 rounded text-sm font-semibold hover:underline"
                  >
                    {t("moreToday", { count: hiddenCount })}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </li>
              ) : null}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          {/* Who walks in next. */}
          <section className="from-primary relative overflow-hidden rounded-2xl bg-gradient-to-br to-[#b8554b] p-5 text-white shadow-[var(--shadow-lift)]">
            <div
              className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10 blur-2xl"
              aria-hidden
            />
            <p className="text-xs font-medium tracking-[0.14em] text-white/80 uppercase">
              {t("nextUp")}
            </p>
            {upcoming ? (
              <>
                <p className="font-heading mt-3 text-4xl leading-none tabular-nums">
                  {formatTime(upcoming.starts_at, zoned)}
                </p>
                <p className="mt-3 truncate text-lg font-medium">{upcoming.customer_name ?? "—"}</p>
                <p className="truncate text-sm text-white/80">
                  {serviceName(upcoming)}
                  {upcoming.staff_profiles ? ` · ${upcoming.staff_profiles.display_name}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-white/90">{t("nextUpEmpty")}</p>
            )}
          </section>

          <section className="glowa-card rounded-2xl p-5">
            <h2 className="text-muted-foreground mb-4 text-xs font-medium tracking-[0.14em] uppercase">
              {t("thisMonth")}
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              {[
                { label: t("newClients"), value: metrics?.new_clients ?? 0, icon: UserPlus },
                { label: t("returningClients"), value: metrics?.returning_clients ?? 0, icon: Users },
                { label: t("cancelled"), value: metrics?.appointments_cancelled ?? 0, icon: CircleSlash },
                { label: t("noShows"), value: metrics?.appointments_no_show ?? 0, icon: CircleSlash },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-xl p-3">
                  <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <item.icon className="size-3.5" aria-hidden />
                    {item.label}
                  </dt>
                  <dd className="font-heading mt-1 text-2xl tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {(metrics?.unanswered_reviews ?? 0) > 0 ? (
            <Link
              href="/dashboard/reviews"
              className="glowa-card glowa-focus hover:shadow-lift flex items-center gap-4 rounded-2xl p-4 transition-shadow"
            >
              <span className="bg-warning/14 text-warning flex size-10 items-center justify-center rounded-xl">
                <Star className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-heading block text-lg leading-none">
                  {metrics?.unanswered_reviews}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {t("unansweredReviews")}
                </span>
              </span>
              <ArrowRight className="text-muted-foreground size-4" aria-hidden />
            </Link>
          ) : null}

          <section className="glowa-card rounded-2xl p-5">
            <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.14em] uppercase">
              {t("quickActions")}
            </h2>
            <ul className="space-y-1">
              {quickActions.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="glowa-focus hover:bg-muted/70 group flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors"
                  >
                    <span className="bg-secondary text-primary flex size-8 items-center justify-center rounded-lg">
                      <action.icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1">{action.label}</span>
                    <ArrowRight
                      className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
