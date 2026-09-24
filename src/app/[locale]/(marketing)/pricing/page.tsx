import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRICING_IS_PUBLISHED } from "@/lib/pricing";
import { alternatesFor } from "@/lib/seo/structured-data";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });

  return {
    title: t("eyebrow"),
    description: t("subtitle"),
    alternates: alternatesFor(`/${locale}/pricing`),
  };
}

const FAQ_KEYS = ["1", "2", "3", "4", "5"] as const;

export default async function PricingPage({
  params,
}: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pricing");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      {/* --------------------------------------------------------------- head */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-primary text-xs font-semibold tracking-[0.28em] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-heading mt-4 text-4xl leading-[1.08] text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-5 text-base leading-relaxed text-pretty sm:text-lg">
          {t("subtitle")}
        </p>
      </div>

      {/* Shown instead of a number, never alongside one: an invented price is
          worse than an honest gap. */}
      {PRICING_IS_PUBLISHED ? null : (
        <div className="glowa-card mx-auto mt-10 max-w-2xl p-6 text-center sm:p-8">
          <Badge variant="secondary">{t("unpublished.badge")}</Badge>
          <h2 className="font-heading mt-4 text-xl">
            {t("unpublished.title")}
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            {t("unpublished.body")}
          </p>
          <Button asChild className="mt-5">
            <a href="mailto:hello@glowa.bg">
              {t("unpublished.cta")}
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      )}

      {/* -------------------------------------------------------------- plans */}
      <div className="mt-12">
        <PricingPlans />
      </div>

      {PRICING_IS_PUBLISHED ? (
        <p className="text-muted-foreground mt-6 text-center text-xs">
          {t("billing.vat")} {t("billing.annualNote")}
        </p>
      ) : null}

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
                {t(`faq.a${key}`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </main>
  );
}
