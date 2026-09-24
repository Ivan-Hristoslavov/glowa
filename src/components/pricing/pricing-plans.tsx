"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPlanPrice, PLANS, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * The three plans with a monthly / yearly switch. Yearly is shown as its
 * monthly equivalent, because that is the number people compare.
 *
 * The same cards serve the billing page in the dashboard: `action` replaces
 * the sign-up button with "choose" / "manage", and `current` / `recommended`
 * mark the salon's plan and the one its team size points at.
 */
export function PricingPlans({
  action,
  current,
  recommended,
}: {
  action?: (plan: PlanId, interval: "month" | "year") => ReactNode;
  current?: PlanId | null;
  recommended?: PlanId | null;
} = {}) {
  const t = useTranslations("pricing");
  const locale = useLocale() as Locale;
  const [annual, setAnnual] = useState(false);
  // Owners sign up and go straight on to create their salon.
  const signupHref = `/signup?next=${encodeURIComponent(`/${locale}/onboarding`)}`;

  return (
    <div>
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label={t("billing.label")}
          className="bg-muted inline-flex items-center gap-1 rounded-full p-1"
        >
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              role="radio"
              aria-checked={annual === value}
              onClick={() => setAnnual(value)}
              className={cn(
                "glowa-focus inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                annual === value
                  ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value ? t("billing.annual") : t("billing.monthly")}
              {value ? (
                <span className="bg-success/15 text-success rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                  {t("billing.annualSave")}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const amount = annual ? plan.annualMonthly : plan.monthly;
          const price = formatPlanPrice(amount, plan.currency, locale);
          const free = amount === 0;

          return (
            <div
              key={plan.id}
              data-glow
              className={cn(
                "glowa-card glowa-glow flex flex-col rounded-3xl p-6 sm:p-7",
                plan.featured && "border-primary/50 ring-primary/15 ring-2",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-2xl">{t(`plans.${plan.id}.name`)}</h2>
                {current === plan.id ? (
                  <Badge className="bg-success text-success-foreground">{t("cta.current")}</Badge>
                ) : recommended === plan.id ? (
                  <Badge>{t("cta.recommended")}</Badge>
                ) : plan.featured && !recommended ? (
                  <Badge>{t("cta.popular")}</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-2 min-h-10 text-sm leading-relaxed">
                {t(`plans.${plan.id}.tagline`)}
              </p>

              <div className="mt-6">
                <p className="flex items-baseline gap-1.5">
                  <span className="font-heading text-5xl tabular-nums">{price}</span>
                  <span className="text-muted-foreground text-sm">
                    {free ? t("billing.forever") : t("billing.perMonth")}
                  </span>
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  {t(`plans.${plan.id}.seats`)}
                  {annual && !free ? ` · ${t("billing.billedYearly")}` : ""}
                </p>
              </div>

              {action ? (
                <div className="mt-6">{action(plan.id, annual ? "year" : "month")}</div>
              ) : (
                <Button
                  asChild
                  variant={plan.featured ? "default" : "outline"}
                  className="mt-6 w-full rounded-full"
                >
                  <Link href={signupHref}>{free ? t("cta.startFree") : t("cta.start")}</Link>
                </Button>
              )}

              <ul className="mt-7 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
                    <span className="text-pretty">{t(`features.${feature}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
