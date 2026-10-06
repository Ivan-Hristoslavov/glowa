"use client";

import { ArrowDownRight, ArrowUpRight, ExternalLink, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Sparkline, TimeSeriesChart } from "@/components/platform/time-series-chart";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";
import type { PlatformOverview, SalonRow } from "@/lib/platform/overview";
import { cn } from "@/lib/utils";

type RangeDays = 7 | 30 | 90 | 365;
type Metric = "bookings" | "onlineBookings" | "businesses" | "users" | "bookedValue";
type Filter = "all" | "attention" | "active" | "draft" | "paying";
type SortKey = "created" | "bookings30" | "bookingsTotal" | "clients" | "name";
type Flag = "noServices" | "unpublished" | "noBookings" | "paymentIssue" | "trialEnding";

const RANGES: RangeDays[] = [7, 30, 90, 365];
const METRICS: Metric[] = ["bookings", "onlineBookings", "businesses", "users", "bookedValue"];
const DAY = 86_400_000;
/** Days are cut in the platform's own time zone, so the server and any browser print the same label. */
const ZONE = "Europe/Sofia";

function metricValue(point: PlatformOverview["daily"][number], metric: Metric) {
  switch (metric) {
    case "bookings":
      return point.bookings;
    case "onlineBookings":
      return point.online_bookings;
    case "businesses":
      return point.businesses;
    case "users":
      return point.users;
    case "bookedValue":
      return point.booked_cents / 100;
  }
}

/** What a person should do about this salon, most urgent first. */
function flagsFor(salon: SalonRow, now: number): Flag[] {
  const flags: Flag[] = [];
  if (salon.subscription_status === "past_due" || salon.subscription_status === "unpaid") flags.push("paymentIssue");
  if (
    salon.subscription_status === "trialing" &&
    salon.period_end &&
    new Date(salon.period_end).getTime() - now < 7 * DAY
  ) {
    flags.push("trialEnding");
  }
  const ageDays = (now - new Date(salon.created_at).getTime()) / DAY;
  if (salon.services === 0 && ageDays > 1) flags.push("noServices");
  else if (salon.status === "draft" && ageDays > 2) flags.push("unpublished");
  if (salon.status === "active" && salon.bookings_30d === 0 && ageDays > 14) flags.push("noBookings");
  return flags;
}

export function PlatformDashboard({ data }: { data: PlatformOverview }) {
  const t = useTranslations("platform");
  const locale = useLocale();
  const [range, setRange] = useState<RangeDays>(30);
  const [metric, setMetric] = useState<Metric>("bookings");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  // Taken from the data, not the clock: the server and the browser must agree
  // on which salons are flagged or the page hydrates differently.
  const now = new Date(data.generated_at).getTime();

  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const money = (cents: number) => formatPrice(cents, "EUR", locale as never) ?? "";
  const dayLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: ZONE });
    return (day: string) => fmt.format(new Date(`${day}T12:00:00`));
  }, [locale]);

  const daily = data.daily;
  const window = daily.slice(-range);
  const previous = daily.slice(-range * 2, -range);
  const hasPrevious = previous.length === range;

  const sum = (rows: typeof daily, key: Parameters<typeof metricValue>[1]) =>
    rows.reduce((total, row) => total + metricValue(row, key), 0);
  const delta = (key: Metric) => {
    if (!hasPrevious) return null;
    const current = sum(window, key);
    const before = sum(previous, key);
    if (before === 0) return current === 0 ? 0 : null;
    return Math.round(((current - before) / before) * 100);
  };

  const kpis: Array<{
    key: string;
    label: string;
    value: string;
    note?: string;
    metric?: Metric;
  }> = [
    {
      key: "salons",
      label: t("kpi.salons"),
      value: number.format(data.totals.businesses),
      note: t("kpi.salonsNote", { active: data.totals.active_businesses }),
      metric: "businesses",
    },
    {
      key: "users",
      label: t("kpi.users"),
      value: number.format(data.totals.users),
      metric: "users",
    },
    {
      key: "bookings",
      label: t("kpi.bookings"),
      value: number.format(sum(window, "bookings")),
      note:
        data.totals.online_share_30d === null
          ? undefined
          : t("kpi.online", { share: data.totals.online_share_30d }),
      metric: "bookings",
    },
    {
      key: "bookedValue",
      label: t("kpi.bookedValue"),
      value: money(Math.round(sum(window, "bookedValue") * 100)),
      metric: "bookedValue",
    },
    {
      key: "mrr",
      label: t("kpi.mrr"),
      value: money(data.revenue.mrrCents),
      note: t("kpi.mrrNote", { paying: data.revenue.payingSalons }),
    },
    {
      key: "trial",
      label: t("kpi.trial"),
      value: number.format(data.revenue.trialingSalons),
      note: t("kpi.trialNote", { amount: money(data.revenue.trialMrrCents) }),
    },
  ];

  const chartPoints = window.map((point) => {
    const value = metricValue(point, metric);
    return {
      label: dayLabel(point.day),
      value,
      display: metric === "bookedValue" ? money(Math.round(value * 100)) : number.format(value),
    };
  });
  const chartTotal = chartPoints.reduce((total, point) => total + point.value, 0);
  const chartPeak = chartPoints.reduce((best, point) => (point.value > best.value ? point : best), chartPoints[0] ?? { label: "", value: 0, display: "0" });
  const formatTotal = (value: number) => (metric === "bookedValue" ? money(Math.round(value * 100)) : number.format(value));

  // Funnel: each step is drawn against the first, and labelled with the share
  // of the step before it - that is the number that says where salons leave.
  const salons = data.salons;
  // Nested on purpose: each step only counts salons that passed the one
  // before, so the percentages can never exceed 100.
  const withServices = salons.filter((s) => s.services > 0);
  const published = withServices.filter((s) => s.status === "active");
  const booked = published.filter((s) => s.bookings_total > 0);
  const onPlan = booked.filter(
    (s) => s.subscription_status && ["trialing", "active", "past_due"].includes(s.subscription_status),
  );
  const steps = [
    { key: "registered", count: salons.length },
    { key: "services", count: withServices.length },
    { key: "published", count: published.length },
    { key: "booking", count: booked.length },
    { key: "paying", count: onPlan.length },
  ];

  const mixRows = useMemo(() => {
    const groups = new Map<string, { plan: string; trialing: number; active: number; past_due: number; other: number }>();
    for (const row of data.subscriptions) {
      const entry = groups.get(row.plan) ?? { plan: row.plan, trialing: 0, active: 0, past_due: 0, other: 0 };
      if (row.status === "trialing") entry.trialing += row.count;
      else if (row.status === "active") entry.active += row.count;
      else if (row.status === "past_due") entry.past_due += row.count;
      else entry.other += row.count;
      groups.set(row.plan, entry);
    }
    return ["solo", "studio", "salon"].map((plan) => groups.get(plan) ?? { plan, trialing: 0, active: 0, past_due: 0, other: 0 });
  }, [data.subscriptions]);
  const mixMax = Math.max(1, ...mixRows.map((r) => r.trialing + r.active + r.past_due + r.other));
  const hasSubscriptions = data.subscriptions.length > 0;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = salons
      .map((salon) => ({ salon, flags: flagsFor(salon, now) }))
      .filter(({ salon, flags }) => {
        if (needle && !`${salon.name} ${salon.city ?? ""} ${salon.slug}`.toLowerCase().includes(needle)) return false;
        if (filter === "attention") return flags.length > 0;
        if (filter === "active") return salon.status === "active";
        if (filter === "draft") return salon.status === "draft";
        if (filter === "paying") return Boolean(salon.subscription_status);
        return true;
      });
    list.sort((a, b) => {
      switch (sort) {
        case "bookings30":
          return b.salon.bookings_30d - a.salon.bookings_30d;
        case "bookingsTotal":
          return b.salon.bookings_total - a.salon.bookings_total;
        case "clients":
          return b.salon.clients - a.salon.clients;
        case "name":
          return a.salon.name.localeCompare(b.salon.name, locale);
        default:
          return new Date(b.salon.created_at).getTime() - new Date(a.salon.created_at).getTime();
      }
    });
    return list;
  }, [salons, filter, query, sort, now, locale]);

  const attentionCount = salons.filter((s) => flagsFor(s, now).length > 0).length;
  const dateOnly = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: ZONE });

  return (
    <div className="space-y-6">
      {/* Period */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {t("updated", { time: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: ZONE }).format(new Date(data.generated_at)) })}
          {" · "}
          {t("demoNote")}
        </p>
        <div role="radiogroup" aria-label={t("rangeLabel")} className="bg-muted inline-flex rounded-full p-1">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={range === value}
              onClick={() => setRange(value)}
              className={cn(
                "glowa-focus rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                range === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`range.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Headline numbers */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const change = kpi.metric && kpi.metric !== "businesses" && kpi.metric !== "users" ? delta(kpi.metric) : null;
          const spark = kpi.metric ? window.map((p) => metricValue(p, kpi.metric!)) : null;
          return (
            <li key={kpi.key} className="glowa-card flex flex-col justify-between gap-3 p-4">
              <p className="text-muted-foreground text-xs">{kpi.label}</p>
              <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1.5">
                <p className="font-heading text-2xl leading-none tabular-nums sm:text-[1.7rem]">{kpi.value}</p>
                {spark ? <Sparkline values={spark} /> : null}
              </div>
              <p className="text-muted-foreground flex min-h-4 flex-wrap items-center gap-1.5 text-[0.7rem]">
                {change !== null ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-medium",
                      change > 0 ? "text-success" : change < 0 ? "text-destructive" : "",
                    )}
                    title={t("kpi.vsPrevious", { days: range })}
                  >
                    {change > 0 ? <ArrowUpRight className="size-3" aria-hidden /> : change < 0 ? <ArrowDownRight className="size-3" aria-hidden /> : null}
                    {change > 0 ? "+" : ""}
                    {change}%
                  </span>
                ) : null}
                {kpi.note}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Main chart */}
      <section className="glowa-card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg">{t("chart.title")}</h2>
            <p className="text-muted-foreground mt-1 text-xs tabular-nums">
              {t("chart.total", { value: formatTotal(chartTotal) })}
              {chartPeak.value > 0 ? ` · ${t("chart.peak", { value: `${chartPeak.display} (${chartPeak.label})` })}` : ""}
            </p>
          </div>
          <div role="radiogroup" aria-label={t("chart.metric")} className="flex flex-wrap gap-1.5">
            {METRICS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={metric === value}
                onClick={() => setMetric(value)}
                className={cn(
                  "glowa-focus rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  metric === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                {t(`chart.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <TimeSeriesChart
          points={chartPoints}
          caption={`${t(`chart.${metric}`)} - ${t("chart.tableCaption")}`}
          formatAxis={(value) => (metric === "bookedValue" ? `${number.format(Math.round(value))} €` : number.format(Math.round(value * 10) / 10))}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Funnel */}
        <section className="glowa-card space-y-4 p-5 lg:col-span-3">
          <div>
            <h2 className="font-heading text-lg">{t("funnel.title")}</h2>
            <p className="text-muted-foreground mt-1 text-xs">{t("funnel.help")}</p>
          </div>
          <ol className="space-y-3">
            {steps.map((step, index) => {
              const first = Math.max(1, steps[0].count);
              const before = index === 0 ? null : steps[index - 1].count;
              const share = before ? Math.round((step.count / before) * 100) : null;
              return (
                <li key={step.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{t(`funnel.${step.key}`)}</span>
                    <span className="tabular-nums">
                      <span className="font-medium">{number.format(step.count)}</span>
                      {share !== null ? <span className="text-muted-foreground ml-2 text-xs">{share}%</span> : null}
                    </span>
                  </div>
                  <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${Math.max(step.count > 0 ? 2 : 0, (step.count / first) * 100)}%`,
                        backgroundColor: "var(--chart-1)",
                        opacity: 1 - index * 0.14,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Subscriptions */}
        <section className="glowa-card space-y-4 p-5 lg:col-span-2">
          <h2 className="font-heading text-lg">{t("mix.title")}</h2>
          {hasSubscriptions ? (
            <>
              <ul className="space-y-3.5">
                {mixRows.map((row) => {
                  const total = row.trialing + row.active + row.past_due + row.other;
                  const seg = (n: number) => (n / mixMax) * 100;
                  return (
                    <li key={row.plan} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span>{t("mix.plan", { plan: row.plan })}</span>
                        <span className="tabular-nums font-medium">{total}</span>
                      </div>
                      <div className="bg-muted flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                        <span style={{ width: `${seg(row.active)}%`, backgroundColor: "var(--chart-1)" }} title={`${t("mix.status.active")}: ${row.active}`} />
                        <span style={{ width: `${seg(row.trialing)}%`, backgroundColor: "var(--chart-2)" }} title={`${t("mix.status.trialing")}: ${row.trialing}`} />
                        <span style={{ width: `${seg(row.past_due)}%`, backgroundColor: "var(--destructive)" }} title={`${t("mix.status.past_due")}: ${row.past_due}`} />
                        <span style={{ width: `${seg(row.other)}%`, backgroundColor: "var(--chart-4)" }} title={`${t("mix.status.other")}: ${row.other}`} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {[
                  ["active", "var(--chart-1)"],
                  ["trialing", "var(--chart-2)"],
                  ["past_due", "var(--destructive)"],
                  ["other", "var(--chart-4)"],
                ].map(([key, color]) => (
                  <li key={key} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden />
                    {t(`mix.status.${key}`)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">{t("mix.empty")}</p>
          )}
          <p className="text-muted-foreground border-t pt-3 text-xs leading-relaxed">{t("revenueNote")}</p>
        </section>
      </div>

      {/* Salons */}
      <section className="glowa-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg">
            {t("table.title")}{" "}
            <span className="text-muted-foreground text-sm font-normal">· {t("table.count", { count: rows.length })}</span>
          </h2>
          <label className="relative block w-full sm:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("table.search")}
              aria-label={t("table.search")}
              className="glowa-focus bg-background h-9 w-full rounded-full border pr-3 pl-9 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "attention", "active", "draft", "paying"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "glowa-focus rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filter.${value}`)}
              {value === "attention" && attentionCount > 0 ? ` · ${attentionCount}` : ""}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">{t("table.empty")}</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr className="border-b">
                  {(
                    [
                      ["name", t("table.salon")],
                      [null, t("table.status")],
                      [null, t("table.plan")],
                      ["bookings30", t("table.bookings30")],
                      ["bookingsTotal", t("table.bookingsTotal")],
                      ["clients", t("table.clients")],
                      ["created", t("table.created")],
                      [null, t("table.attention")],
                    ] as Array<[SortKey | null, string]>
                  ).map(([key, label]) => (
                    <th key={label} scope="col" className="py-2 pr-4 font-medium" aria-sort={key && sort === key ? "descending" : undefined}>
                      {key ? (
                        <button
                          type="button"
                          onClick={() => setSort(key)}
                          className={cn("glowa-focus rounded hover:text-foreground", sort === key && "text-foreground")}
                        >
                          {label}
                          {sort === key ? " ↓" : ""}
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ salon, flags }) => (
                  <tr key={salon.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/business/${salon.slug}`}
                        className="glowa-focus inline-flex items-center gap-1.5 rounded font-medium hover:underline"
                        title={t("table.open")}
                      >
                        {salon.name}
                        <ExternalLink className="text-muted-foreground size-3" aria-hidden />
                      </Link>
                      <p className="text-muted-foreground text-xs">{salon.city ?? "—"}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={salon.status === "active" ? "default" : "outline"} className="font-normal">
                        {t(`status.${salon.status as "draft"}`)}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {salon.plan ? (
                        <>
                          <span className="font-medium">{t("mix.plan", { plan: salon.plan })}</span>
                          <span className="text-muted-foreground block">
                            {salon.subscription_status === "trialing" ? t("mix.status.trialing") : salon.subscription_status === "active" ? t("mix.status.active") : salon.subscription_status === "past_due" ? t("mix.status.past_due") : t("mix.status.other")}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{t("table.noPlan")}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{number.format(salon.bookings_30d)}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {number.format(salon.bookings_total)}
                      <span className="text-muted-foreground block text-xs">
                        {salon.last_booking_at ? dateOnly.format(new Date(salon.last_booking_at)) : t("table.never")}
                      </span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{number.format(salon.clients)}</td>
                    <td className="py-3 pr-4 text-xs whitespace-nowrap">{dateOnly.format(new Date(salon.created_at))}</td>
                    <td className="py-3 text-xs">
                      {flags.length === 0 ? (
                        <span className="text-muted-foreground">{t("flag.ok")}</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {flags.slice(0, 2).map((flag) => (
                            <li key={flag} className={flag === "paymentIssue" ? "text-destructive font-medium" : ""}>
                              {t(`flag.${flag}`)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
