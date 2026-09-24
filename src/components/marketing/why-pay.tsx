import {
  ArrowRight,
  CalendarCheck,
  ChartNoAxesColumn,
  HeartHandshake,
  Repeat,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const POINTS: { key: string; icon: LucideIcon; wide?: boolean }[] = [
  { key: "rebook", icon: Repeat, wide: true },
  { key: "waitlist", icon: CalendarCheck },
  { key: "deposits", icon: ShieldCheck },
  { key: "yours", icon: HeartHandshake },
  { key: "proof", icon: ChartNoAxesColumn },
];

/**
 * The answer to "why pay, when booking elsewhere is free?". Every point is a
 * feature that exists and runs on its own; none of it names a competitor or
 * quotes a number the product cannot back up.
 */
export async function WhyPay({ pricingLink = false }: { pricingLink?: boolean }) {
  const t = await getTranslations("whyPay");

  return (
    <section aria-labelledby="why-pay-title" className="mx-auto w-full max-w-6xl">
      <Reveal onView className="mx-auto max-w-3xl text-center">
        <p className="text-primary text-xs font-semibold tracking-[0.28em] uppercase">
          {t("eyebrow")}
        </p>
        <h2
          id="why-pay-title"
          className="font-heading mt-4 text-3xl leading-tight text-balance sm:text-5xl"
        >
          {t("title")}
        </h2>
        <p className="text-muted-foreground mt-5 text-lg leading-relaxed text-pretty">
          {t("subtitle")}
        </p>
      </Reveal>

      <Stagger onView className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {POINTS.map((point) => (
          <StaggerItem key={point.key} className={cn(point.wide && "xl:col-span-2")}>
            <div
              data-glow
              className={cn(
                "glowa-glow relative h-full overflow-hidden rounded-2xl border p-6",
                point.wide
                  ? "from-primary border-primary/0 bg-gradient-to-br to-[#b8554b] text-white shadow-[var(--shadow-lift)]"
                  : "glowa-card",
              )}
            >
              {point.wide ? (
                <div
                  className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl"
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-xl",
                  point.wide ? "bg-white/15 text-white" : "bg-primary/12 text-primary",
                )}
              >
                <point.icon className="size-5" aria-hidden />
              </span>
              <h3
                className={cn(
                  "font-heading relative mt-5 leading-snug text-balance",
                  point.wide ? "text-2xl sm:text-3xl" : "text-xl",
                )}
              >
                {t(`${point.key}.title`)}
              </h3>
              <p
                className={cn(
                  "relative mt-3 leading-relaxed text-pretty",
                  point.wide ? "max-w-xl text-white/90 sm:text-lg" : "text-muted-foreground",
                )}
              >
                {t(`${point.key}.body`)}
              </p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {pricingLink ? (
        <div className="mt-10 text-center">
          <Button asChild variant="outline" size="lg" className="rounded-full px-7">
            <Link href="/pricing">
              {t("seePricing")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
