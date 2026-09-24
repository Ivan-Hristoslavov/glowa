import { ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PublishBusinessButton } from "@/components/admin/publish-business-button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type SetupChecklistProps = {
  businessId: string;
  hasServices: boolean;
  hasHours: boolean;
  hasProfile: boolean;
  isPublished: boolean;
};

/**
 * What a new salon still has to do before customers can book it, in order.
 *
 * It replaces a "your business is a draft" notice with a "publish" button
 * that refused with a toast when there were no services: the owner was told
 * what was wrong only after pressing the button, and nothing said where to
 * fix it. Each step here links to the screen that completes it, and publish
 * waits until it can succeed.
 */
export async function SetupChecklist({
  businessId,
  hasServices,
  hasHours,
  hasProfile,
  isPublished,
}: SetupChecklistProps) {
  const t = await getTranslations("admin.dashboard.setup");

  const steps = [
    { key: "created", done: true, href: null },
    { key: "services", done: hasServices, href: "/dashboard/services" },
    { key: "hours", done: hasHours, href: "/dashboard/settings" },
    { key: "profile", done: hasProfile, href: "/dashboard/settings" },
    { key: "publish", done: isPublished, href: null },
  ] as const;

  const doneCount = steps.filter((step) => step.done).length;
  const progress = doneCount / steps.length;
  const nextKey = steps.find((step) => !step.done)?.key;
  const circumference = 2 * Math.PI * 22;

  return (
    <section className="glowa-card glowa-enter overflow-hidden rounded-3xl">
      <div className="from-accent flex items-center gap-5 bg-gradient-to-r to-transparent p-5 sm:p-6">
        <div className="relative size-16 shrink-0">
          <svg viewBox="0 0 52 52" className="size-16 -rotate-90" aria-hidden>
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" strokeWidth="5" />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-1000 ease-[var(--ease-glowa)]"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div>
          <h2 className="font-heading text-xl">{t("title")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("body", { done: doneCount, total: steps.length })}
          </p>
        </div>
      </div>

      <ol className="divide-border/70 divide-y border-t">
        {steps.map((step, index) => {
          const isNext = step.key === nextKey;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-4 px-5 py-4 transition-colors sm:px-6",
                isNext && "bg-accent/40",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  step.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : isNext
                      ? "border-primary text-primary"
                      : "text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  {t(`${step.key}.title`)}
                </p>
                {!step.done ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">{t(`${step.key}.body`)}</p>
                ) : null}
              </div>
              {!step.done && step.key === "publish" && hasServices ? (
                <PublishBusinessButton businessId={businessId} />
              ) : !step.done && step.href ? (
                <Link
                  href={step.href}
                  className={cn(
                    "glowa-focus group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    isNext
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "hover:bg-accent",
                  )}
                >
                  {t(`${step.key}.cta`)}
                  <ArrowRight
                    className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
