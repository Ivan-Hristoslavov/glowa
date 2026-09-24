import { AlertTriangle, CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BillingPlans, ManageBillingButton } from "@/components/admin/billing-plans";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { isLiveSubscription } from "@/lib/billing/plans";
import { isBillingConfigured } from "@/lib/billing/stripe";
import type { PlanId } from "@/lib/pricing";
import { getActiveMembership } from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.billing");
  return { title: t("title"), robots: { index: false, follow: false } };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BillingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/billing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const membership = await getActiveMembership();
  if (!membership) return null;

  const t = await getTranslations("admin.billing");
  const pricing = await getTranslations("pricing");
  const supabase = await createClient();
  const [{ data: subscription }, { count: staffCount }] = await Promise.all([
    supabase
      .from("business_subscriptions")
      .select("plan, billing_interval, status, current_period_end, cancel_at_period_end")
      .eq("business_id", membership.businessId)
      .maybeSingle(),
    supabase
      .from("staff_profiles")
      .select("id", { count: "exact", head: true })
      .eq("business_id", membership.businessId)
      .eq("is_bookable", true),
  ]);

  const canManage = membership.role === "owner" || membership.role === "admin";
  const configured = isBillingConfigured();
  const live = isLiveSubscription(subscription?.status);
  const current = live ? (subscription?.plan as PlanId) : null;
  const team = staffCount ?? 1;
  const recommended: PlanId = team <= 1 ? "solo" : team <= 5 ? "studio" : "salon";
  const status = firstParam((await searchParams).status);
  const until = subscription?.current_period_end
    ? new Intl.DateTimeFormat(localeHrefLang[locale as Locale], {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(subscription.current_period_end))
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          {t("subtitle")}
        </p>
      </div>

      {status === "success" ? (
        <p className="border-success/30 bg-success/10 text-success flex items-center gap-2 rounded-2xl border p-4 text-sm font-medium">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {t("success")}
        </p>
      ) : status === "cancelled" ? (
        <p className="text-muted-foreground rounded-2xl border p-4 text-sm">{t("cancelled")}</p>
      ) : null}

      <section className="glowa-card flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl",
              live ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
            )}
          >
            {live ? <CreditCard className="size-5" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
          </span>
          <div>
            <p className="font-heading text-lg">
              {live && current
                ? t("currentPlan", {
                    plan: pricing(`plans.${current}.name`),
                    interval: t(`interval.${subscription?.billing_interval === "year" ? "year" : "month"}`),
                  })
                : t("earlyAccess")}
            </p>
            <p className="text-muted-foreground text-sm">
              {live
                ? subscription?.cancel_at_period_end
                  ? t("endsOn", { date: until ?? "—" })
                  : t("renewsOn", { date: until ?? "—" })
                : configured
                  ? t("earlyAccessBody")
                  : t("notConfiguredBody")}
            </p>
            {subscription?.status === "past_due" ? (
              <p className="text-destructive mt-2 flex items-center gap-1.5 text-sm font-medium">
                <AlertTriangle className="size-4" aria-hidden />
                {t("pastDue")}
              </p>
            ) : null}
          </div>
        </div>
        {live && canManage && configured ? (
          <ManageBillingButton businessId={membership.businessId} />
        ) : null}
      </section>

      {!canManage ? (
        <p className="text-muted-foreground text-sm">{t("adminsOnly")}</p>
      ) : null}

      <BillingPlans
        businessId={membership.businessId}
        canManage={canManage}
        configured={configured}
        current={current}
        subscribed={live}
        recommended={recommended}
      />

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        {pricing("billing.vat")} {t("stripeNote")}
      </p>
    </div>
  );
}
