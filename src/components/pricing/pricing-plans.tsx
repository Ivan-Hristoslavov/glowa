"use client";

import { Check } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPlanPrice, PLANS, PRICING_IS_PUBLISHED, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "annual";

/**
 * The three plans with a monthly / yearly switch. The switch defaults to
 * yearly - it is the cheaper way to pay, and hiding the cheaper number behind
 * a toggle is a dark pattern in the other direction.
 */
export function PricingPlans({
  compact = false,
  action,
  current,
  recommended,
}: {
  compact?: boolean;
  /** Replaces the sign-up button, e.g. with "choose" on the billing page. */
  action?: (plan: PlanId, interval: "month" | "year") => ReactNode;
  /** The plan the salon pays for, marked on its card. */
  current?: PlanId | null;
  /** The plan the salon's team size points at. */
  recommended?: PlanId | null;
}) {
  const t = useTranslations("pricing");
  const locale = useLocale() as Locale;
  const [billing, setBilling] = useState<Billing>("annual");
  const signupHref = `/signup?next=${encodeURIComponent(`/${locale}/onboarding`)}`;

  return (
    <div>
      {PRICING_IS_PUBLISHED ? (
        <div className="flex justify-center">
          <div
            role="radiogroup"
            aria-label={t("billing.label")}
            className="bg-muted relative inline-grid grid-cols-2 rounded-full p-1 text-sm"
          >
            {(["monthly", "annual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={billing === option}
                onClick={() => setBilling(option)}
                className={cn(
                  "glowa-focus relative rounded-full px-5 py-2 font-medium transition-colors",
                  billing === option
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {billing === option ? (
                  <m.span
                    layoutId={compact ? "billing-pill-compact" : "billing-pill"}
                    className="bg-card absolute inset-0 rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="relative flex items-center gap-2">
                  {t(`billing.${option}`)}
                  {option === "annual" ? (
                    <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                      {t("billing.save")}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn("grid gap-5 lg:grid-cols-3", PRICING_IS_PUBLISHED && "mt-10")}>
        {PLANS.map((plan) => {
          const amount = billing === "annual" ? plan.annualMonthly : plan.monthly;
          const price = formatPlanPrice(amount, plan.currency, locale);
          const yearly =
            billing === "annual" && plan.annualMonthly !== null
              ? formatPlanPrice(plan.annualMonthly * 12, plan.currency, locale)
              : null;

          return (
            <div
              key={plan.id}
              className={cn(
                "glowa-card glowa-lift relative flex flex-col rounded-3xl p-6 sm:p-7",
                plan.featured &&
                  "border-primary/50 ring-primary/15 from-accent/60 to-card bg-gradient-to-b ring-2",
              )}
            >
              {current === plan.id ? (
                <span className="bg-success text-success-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold shadow-md">
                  {t("cta.current")}
                </span>
              ) : recommended === plan.id ? (
                <span className="bg-primary text-primary-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold shadow-md">
                  {t("cta.recommended")}
                </span>
              ) : plan.featured && !recommended ? (
                <span className="bg-primary text-primary-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold shadow-md">
                  {t("cta.popular")}
                </span>
              ) : null}

              <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
                {t(`plans.${plan.id}.audience`)}
              </p>
              <h2 className="font-heading mt-2 text-2xl">{t(`plans.${plan.id}.name`)}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {t(`plans.${plan.id}.tagline`)}
              </p>

              <div className="mt-6 min-h-20">
                {price ? (
                  <>
                    <p className="flex items-baseline gap-1.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <m.span
                          key={`${plan.id}-${billing}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.25 }}
                          className="font-heading text-5xl tabular-nums"
                        >
                          {price}
                        </m.span>
                      </AnimatePresence>
                      <span className="text-muted-foreground text-sm">
                        {t("billing.perMonth")}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {yearly
                        ? t("billing.billedYearly", { amount: yearly })
                        : t("billing.billedMonthly")}
                      {" · "}
                      {t(`plans.${plan.id}.seats`)}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground font-heading text-2xl">
                    {t("unpublished.badge")}
                  </p>
                )}
              </div>

              {action ? (
                <div className="mt-6">{action(plan.id, billing === "annual" ? "year" : "month")}</div>
              ) : (
                <Button
                  asChild
                  size="lg"
                  variant={plan.featured ? "default" : "outline"}
                  className="mt-6 w-full rounded-full"
                >
                  {PRICING_IS_PUBLISHED ? (
                    <Link href={signupHref}>{t("cta.start")}</Link>
                  ) : (
                    <a href="mailto:hello@glowa.bg">{t("cta.contact")}</a>
                  )}
                </Button>
              )}

              {!compact ? (
                <ul className="mt-7 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <Check aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
                      <span className="text-pretty">{t(`features.${feature}`)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
