import { ArrowRight, Download, FileX, Percent, ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WhyPay } from "@/components/marketing/why-pay";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { SavingsCalculator } from "@/components/pricing/savings-calculator";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { EARLY_ACCESS_UNTIL } from "@/lib/pricing";
import { alternatesFor } from "@/lib/seo/structured-data";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });

  return {
    title: t("metaTitle"),
    description: t("subtitle"),
    alternates: alternatesFor(`/${locale}/pricing`),
  };
}

const FAQ_KEYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
const ZERO_KEYS = ["commission", "deposits", "contract", "export"] as const;
const ZERO_ICONS = {
  commission: Percent,
  deposits: ShieldCheck,
  contract: FileX,
  export: Download,
} as const;

export default async function PricingPage({
  params,
}: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pricing");
  const until = new Intl.DateTimeFormat(localeHrefLang[locale as Locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${EARLY_ACCESS_UNTIL}T00:00:00Z`));

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div
        aria-hidden
        className="bg-brand-peach pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-[46rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
      />

      {/* --------------------------------------------------------------- head */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-primary text-xs font-semibold tracking-[0.28em] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-heading mt-4 text-4xl leading-[1.08] text-balance sm:text-6xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-5 text-base leading-relaxed text-pretty sm:text-lg">
          {t("subtitle")}
        </p>
      </div>

      {/* Subscriptions are not billed yet - say so before any number. */}
      <div className="border-primary/30 bg-card mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border p-4 text-sm shadow-[var(--shadow-card)] sm:items-center">
        <Sparkles className="text-primary mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden />
        <p>
          <span className="font-semibold">{t("earlyAccess.title", { date: until })}</span>{" "}
          <span className="text-muted-foreground">{t("earlyAccess.body", { date: until })}</span>
        </p>
      </div>

      {/* -------------------------------------------------------------- plans */}
      <div className="mt-12">
        <PricingPlans />
      </div>
      <p className="text-muted-foreground mt-6 text-center text-xs">
        {t("billing.vat")} {t("billing.annualNote")}
      </p>

      {/* ------------------------------------------------------------- zeroes */}
      <section aria-labelledby="zero-title" className="mt-20">
        <h2 id="zero-title" className="font-heading text-center text-2xl sm:text-3xl">
          {t("zero.title")}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ZERO_KEYS.map((key) => {
            const Icon = ZERO_ICONS[key];
            return (
              <li key={key} data-glow className="glowa-card glowa-glow rounded-2xl p-5">
                <span className="bg-primary/12 text-primary flex size-10 items-center justify-center rounded-xl">
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="font-heading mt-4 text-3xl">{t(`zero.${key}.value`)}</p>
                <p className="mt-1 font-semibold">{t(`zero.${key}.title`)}</p>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {t(`zero.${key}.body`)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------ why pay at all */}
      <div className="mt-24">
        <WhyPay />
      </div>

      {/* --------------------------------------------------------- calculator */}
      <div className="mt-20">
        <SavingsCalculator />
      </div>

      {/* ---------------------------------------------------------------- faq */}
      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="font-heading text-center text-2xl sm:text-3xl">
          {t("faq.title")}
        </h2>
        <Accordion type="single" collapsible className="mt-8">
          {FAQ_KEYS.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="text-left text-base">
                {t(`faq.q${key}`)}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                {t(`faq.a${key}`, { date: until })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <div className="mt-16 text-center">
        <Button asChild size="lg" className="rounded-full px-8">
          <Link href="/signup">
            {t("cta.startFree")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </main>
  );
}
