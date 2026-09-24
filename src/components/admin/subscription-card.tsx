import { ArrowRight, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPlanPrice, PLANS, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * What GLOWA costs this salon, and which plan fits its team. The paying
 * happens on /dashboard/billing (Stripe); this card is the summary in
 * settings: the plan it pays for, or "early access" while it pays nothing.
 */
export async function SubscriptionCard({
  staffCount,
  activePlan = null,
}: {
  staffCount: number;
  activePlan?: PlanId | null;
}) {
  const t = await getTranslations("admin.subscription");
  const pricing = await getTranslations("pricing");
  const locale = (await getLocale()) as Locale;

  const recommended: PlanId = staffCount <= 1 ? "solo" : staffCount <= 5 ? "studio" : "salon";

  return (
    <section className="glowa-card overflow-hidden rounded-3xl">
      <div className="from-accent flex flex-wrap items-start justify-between gap-4 bg-gradient-to-r to-transparent p-5 sm:p-6">
        <div className="max-w-xl">
          <h2 className="font-heading text-xl">{t("title")}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {activePlan ? t("bodyActive") : t("body")}
          </p>
        </div>
        <span className="bg-success/15 text-success inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
          <Sparkles className="size-3.5" aria-hidden />
          {activePlan ? t("activePlan", { plan: pricing(`plans.${activePlan}.name`) }) : t("status")}
        </span>
      </div>

      <ul className="grid border-t sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isRecommended = plan.id === recommended;
          return (
            <li
              key={plan.id}
              className={cn(
                "relative border-b p-5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0",
                isRecommended && "bg-accent/40",
              )}
            >
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {pricing(`plans.${plan.id}.audience`)}
              </p>
              <p className="font-heading mt-1 text-lg">{pricing(`plans.${plan.id}.name`)}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="font-heading text-3xl tabular-nums">
                  {formatPlanPrice(plan.monthly, plan.currency, locale)}
                </span>
                <span className="text-muted-foreground text-xs">{pricing("billing.perMonth")}</span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {pricing("billing.orYearly", {
                  amount: formatPlanPrice(plan.annualMonthly, plan.currency, locale) ?? "",
                })}{" "}
                · {pricing(`plans.${plan.id}.seats`)}
              </p>
              {isRecommended ? (
                <span className="bg-primary text-primary-foreground mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold">
                  {t("recommended", { count: staffCount })}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="border-t p-4 sm:px-6">
        <Link
          href="/dashboard/billing"
          className="text-primary glowa-focus group inline-flex items-center gap-1 rounded text-sm font-medium"
        >
          {t("choosePlan")}
          <ArrowRight
            className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}
