import {
  BadgeCheck,
  CalendarCheck2,
  Clock3,
  ExternalLink,
  Info,
  ShieldCheck,
  Undo2,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MetricCard } from "@/components/admin/metric-card";
import {
  ConnectPaymentsButton,
  RefreshPaymentsButton,
} from "@/components/admin/payments-connect";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import { syncAccountStatus } from "@/lib/payments/connect";
import { isStripeConfigured } from "@/lib/payments/stripe";
import {
  canAdminister,
  getActiveMembership,
  getDepositOverview,
  listPaymentRecords,
} from "@/lib/queries/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.payments");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function PaymentsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/payments">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.payments");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const isAdmin = canAdminister(membership.role);
  const configured = isStripeConfigured();
  const sp = await searchParams;

  let overview = await getDepositOverview(membership.businessId);

  // Back from Stripe's onboarding. Read the account's state now instead of
  // waiting for the webhook, so the salon sees the result of what it just did.
  if (sp.stripe === "return" && isAdmin && configured && overview.account) {
    try {
      await syncAccountStatus(overview.account.account_id);
      overview = await getDepositOverview(membership.businessId);
    } catch (cause) {
      console.error("payments: sync on return failed", cause);
    }
  }

  const records = await listPaymentRecords(membership.businessId);
  const activeLocale = locale as Locale;
  const money = (cents: number, currency = overview.currency) =>
    formatPrice(cents, currency, activeLocale) ?? "—";
  const dateFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const collected = records
    .filter((r) => r.kind === "deposit" && r.status === "succeeded")
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const refunded = records
    .filter((r) => r.kind === "refund" && r.status === "succeeded")
    .reduce((sum, r) => sum + r.amount_cents, 0);

  const account = overview.account;
  const state: "unconfigured" | "disconnected" | "pending" | "active" = !configured
    ? "unconfigured"
    : !account
      ? "disconnected"
      : account.charges_enabled
        ? "active"
        : "pending";

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {state === "unconfigured" ? (
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
      ) : null}

      {state === "disconnected" ? (
        <section className="glowa-card from-brand-soft/40 via-card to-card overflow-hidden bg-gradient-to-br p-6 sm:p-8">
          <Badge variant="secondary" className="mb-4">
            <ShieldCheck className="size-3.5" aria-hidden />
            {t("pitchEyebrow")}
          </Badge>
          <h2 className="font-heading max-w-xl text-2xl leading-tight sm:text-3xl">
            {t("pitchTitle")}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
            {t("pitchBody")}
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {(["pitchPoint1", "pitchPoint2", "pitchPoint3"] as const).map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm">
                <BadgeCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {isAdmin ? (
              <ConnectPaymentsButton businessId={membership.businessId} label={t("connect")} />
            ) : (
              <p className="text-muted-foreground text-sm">{t("adminOnly")}</p>
            )}
            <p className="text-muted-foreground text-xs">{t("stripeNote")}</p>
          </div>
        </section>
      ) : null}

      {state === "pending" && account ? (
        <section className="glowa-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl space-y-2">
              <Badge variant="outline">
                <Clock3 className="size-3.5" aria-hidden />
                {account.details_submitted ? t("reviewing") : t("unfinished")}
              </Badge>
              <h2 className="font-heading text-xl">{t("pendingTitle")}</h2>
              <p className="text-muted-foreground text-sm">
                {account.details_submitted ? t("reviewingBody") : t("unfinishedBody")}
              </p>
              {sp.stripe === "refresh" ? (
                <p className="text-primary text-sm">{t("linkExpired")}</p>
              ) : null}
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <RefreshPaymentsButton businessId={membership.businessId} />
                {!account.details_submitted || sp.stripe === "refresh" ? (
                  <ConnectPaymentsButton
                    businessId={membership.businessId}
                    label={t("continueSetup")}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {state === "active" ? (
        <section className="glowa-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl space-y-2">
              <Badge className="bg-success text-success-foreground">
                <ShieldCheck className="size-3.5" aria-hidden />
                {t("activeBadge")}
              </Badge>
              <h2 className="font-heading text-xl">{t("activeTitle")}</h2>
              <p className="text-muted-foreground text-sm">
                {overview.depositServices > 0
                  ? t("activeBody", { count: overview.depositServices })
                  : t("activeNoServices")}
              </p>
              {!account?.payouts_enabled ? (
                <p className="text-primary text-sm">{t("payoutsPending")}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant={overview.depositServices > 0 ? "outline" : "default"}>
                <Link href="/dashboard/services">{t("configureServices")}</Link>
              </Button>
              <Button asChild variant="ghost">
                <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                  {t("openStripe")}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {state === "active" || records.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label={t("collected")} value={money(collected)} icon={Wallet} />
          <MetricCard
            label={t("protected")}
            value={money(overview.retainedCents)}
            hint={t("protectedHint")}
            icon={CalendarCheck2}
          />
          <MetricCard label={t("refunded")} value={money(refunded)} icon={Undo2} />
        </div>
      ) : null}

      <Section title={t("history")}>
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
                  {record.status === "failed" && record.failure_reason ? (
                    <span className="text-destructive block truncate text-xs">
                      {record.failure_reason}
                    </span>
                  ) : null}
                </span>
                <Badge variant="outline" className="font-normal">
                  {t(`kind.${record.kind}`)}
                </Badge>
                <Badge
                  variant={
                    record.status === "succeeded"
                      ? "secondary"
                      : record.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {t(`status.${record.status}`)}
                </Badge>
                <span className="font-medium tabular-nums">
                  {record.kind === "refund" ? "−" : ""}
                  {money(record.amount_cents, record.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
