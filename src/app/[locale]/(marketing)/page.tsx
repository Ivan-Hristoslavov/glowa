import { ArrowRight, CalendarCheck, Check, ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { GlowaMark } from "@/components/brand/glowa-logo";
import { FEATURE_ICONS, type FeatureIconKey } from "@/components/brand/feature-icons";
import { JsonLd } from "@/components/common/json-ld";
import { Section } from "@/components/common/section";
import { BusinessCard } from "@/components/discovery/business-card";
import { CategoryGrid } from "@/components/discovery/category-grid";
import { SearchForm } from "@/components/discovery/search-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { brandAssets, featureArt } from "@/lib/brand-assets";
import { listCities, searchBusinesses } from "@/lib/queries/discovery";
import { organizationJsonLd } from "@/lib/seo/structured-data";

const FEATURES: FeatureIconKey[] = [
  "booking",
  "teamCalendar",
  "clients",
  "payments",
  "marketing",
  "analytics",
  "assistant",
];

/**
 * Revalidated hourly: the featured salons change when a business joins or
 * goes live, and nothing on this page is per-visitor any more.
 */
export const revalidate = 3600;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const brand = await getTranslations("brand");
  const [cities, featured] = await Promise.all([
    listCities(),
    searchBusinesses({ limit: 3 }),
  ]);

  const badges = [
    { key: "noCard", icon: ShieldCheck },
    { key: "fastSetup", icon: CalendarCheck },
    { key: "localSupport", icon: Sparkles },
  ] as const;

  return (
    <main>
      <JsonLd data={organizationJsonLd(locale as Locale)} />

      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="bg-brand-soft/45 pointer-events-none absolute -top-40 -right-32 size-[26rem] rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="bg-brand-sage/35 pointer-events-none absolute -bottom-52 -left-40 size-[24rem] rounded-full blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:pb-24">
          <div>
            <p className="text-primary text-xs font-semibold tracking-[0.28em] uppercase">
              {t("eyebrow")}
            </p>

            <h1 className="font-heading mt-5 text-4xl leading-[1.05] text-balance sm:text-6xl">
              <span className="block">{t("titleLine1")}</span>
              <span className="text-primary block">{t("titleLine2")}</span>
            </h1>

            <p className="text-muted-foreground mt-6 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
              {t("subtitle")}
            </p>

            <div className="glowa-card mt-8 max-w-xl p-3 sm:p-4">
              <SearchForm cities={cities} variant="hero" />
            </div>

            {/* The search box above is the customer's action, and "browse
                salons" only repeated it. Two filled coral buttons under it
                left the eye with nothing to grab. What remains is one line
                for the other audience entirely: salon owners. */}
            <p className="text-muted-foreground mt-6 text-sm">
              {t("ownerPrompt")}{" "}
              <Link
                href="/signup"
                className="text-primary glowa-focus rounded font-medium underline-offset-4 hover:underline"
              >
                {t("ctaPrimary")}
                <ArrowRight className="ml-1 inline size-3.5 align-[-2px]" aria-hidden />
              </Link>
            </p>

            <ul className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {badges.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-center gap-2">
                  <Icon className="text-primary size-4" aria-hidden />
                  {t(`badges.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Two exposures of the same scene rather than one image dimmed by
              CSS: the dark theme gets a photograph actually lit for it. The
              swap is class-based, so server and client render the same markup. */}
          <div className="relative">
            <div className="glowa-card relative aspect-[4/3] overflow-hidden rounded-2xl p-0 shadow-[var(--shadow-pop)]">
              <Image
                src={brandAssets.heroLight}
                alt={t("heroAlt")}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover dark:hidden"
              />
              <Image
                src={brandAssets.heroDark}
                alt={t("heroAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="hidden object-cover dark:block"
              />
            </div>
            <p className="text-muted-foreground mt-3 text-center text-[0.7rem] tracking-[0.18em] uppercase lg:text-right">
              {t("trustLine")}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- categories */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
            {t("categories.eyebrow")}
          </p>
          <h2 className="font-heading mt-3 text-3xl leading-tight text-balance sm:text-4xl">
            {t("categories.title")}
          </h2>
          <p className="text-muted-foreground mt-3 text-pretty">
            {t("categories.subtitle")}
          </p>
        </div>
        <CategoryGrid />
      </section>

      {/* ------------------------------------------------------------ features */}
      <section className="border-border/60 border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
              {t("features.eyebrow")}
            </p>
            <h2 className="font-heading mt-4 text-3xl leading-tight text-balance sm:text-4xl">
              {t("features.title")}{" "}
              <span className="text-primary">{t("features.titleAccent")}</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-pretty">
              {t("features.subtitle")}
            </p>
          </div>

          <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((key) => {
              const Icon = FEATURE_ICONS[key];
              return (
                <li key={key} className="text-center sm:text-left">
                  {/* Illustration where there is room for it, icon where there
                      is not: a raster drawing at 24px is mush, and the icon
                      family was drawn for exactly that size. */}
                  <span className="bg-secondary text-primary mx-auto flex size-12 items-center justify-center rounded-xl sm:hidden">
                    <Icon className="size-6" />
                  </span>
                  <Image
                    src={featureArt[key]}
                    alt=""
                    width={72}
                    height={72}
                    className="hidden size-16 rounded-xl object-cover sm:block"
                  />
                  <h3 className="mt-4 font-medium">{t(`features.${key}.title`)}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {t(`features.${key}.body`)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------------- growth */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-[3/2] lg:aspect-[4/5]">
            <Image
              src={brandAssets.heroMobile}
              alt={t("heroAlt")}
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          </div>

          <div>
            <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
              {t("growth.eyebrow")}
            </p>
            <h2 className="font-heading mt-4 text-3xl leading-tight text-balance sm:text-4xl">
              {t("growth.title")}
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed text-pretty">
              {t("growth.body")}
            </p>

            <ul className="mt-6 space-y-3">
              {["point1", "point2", "point3"].map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  {t(`growth.${point}`)}
                </li>
              ))}
            </ul>

            <Button asChild size="lg" className="mt-8">
              <Link href="/signup">
                {t("growth.cta")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ featured */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <Section
            title={t("featured.title")}
            description={t("featured.subtitle")}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/search">
                  {t("featured.all")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            }
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((business) => (
                <BusinessCard
                  key={business.id}
                  business={business}
                  locale={locale as Locale}
                />
              ))}
            </div>
          </Section>
        </section>
      ) : null}

      {/* What GLOWA commits to, stated plainly. Still no invented traction:
          a promise is something we control, a customer count is not. */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="glowa-card flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-8 sm:p-8">
          <GlowaMark className="size-10 shrink-0" />
          <div className="flex-1">
            <Badge variant="secondary" className="mb-3">
              {t("foundation.status")}
            </Badge>
            <h2 className="font-heading text-xl">{t("foundation.title")}</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              {t("foundation.body")}
            </p>
            <p className="text-muted-foreground mt-4 text-xs">{brand("madeIn")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
