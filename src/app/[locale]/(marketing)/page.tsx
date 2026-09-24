import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Check,
  MapPin,
  PartyPopper,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { GlowaMark } from "@/components/brand/glowa-logo";
import { FEATURE_ICONS, type FeatureIconKey } from "@/components/brand/feature-icons";
import { JsonLd } from "@/components/common/json-ld";
import { BusinessCard } from "@/components/discovery/business-card";
import { CategoryGrid } from "@/components/discovery/category-grid";
import { SearchForm } from "@/components/discovery/search-form";
import { BusinessShowcase } from "@/components/home/business-showcase";
import { HeroShowcase } from "@/components/home/hero-showcase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { brandAssets } from "@/lib/brand-assets";
import { formatPrice } from "@/lib/format";
import { PLANS } from "@/lib/pricing";
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

const QUICK_PICKS = ["haircut", "color", "manicure", "massage", "lashes", "beard"] as const;

/**
 * Revalidated hourly: the featured salons change when a business joins or
 * goes live, and nothing on this page is per-visitor any more.
 */
export const revalidate = 3600;

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as React.CSSProperties;

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

  const ownerHref = `/signup?next=${encodeURIComponent(`/${locale}/onboarding`)}`;
  // The cheapest published plan, billed yearly - the same figure the pricing
  // page leads with. Unpublished pricing (null) hides the line.
  const cheapest = PLANS.filter((plan) => plan.annualMonthly != null).sort(
    (a, b) => (a.annualMonthly ?? 0) - (b.annualMonthly ?? 0),
  )[0];
  const fromPrice = cheapest
    ? formatPrice(cheapest.annualMonthly, cheapest.currency, locale as Locale)
    : null;
  const examples = [t("typing.p1"), t("typing.p2"), t("typing.p3"), t("typing.p4")];

  const steps = [
    { key: "step1", icon: Search },
    { key: "step2", icon: CalendarClock },
    { key: "step3", icon: PartyPopper },
  ] as const;

  return (
    <main className="overflow-x-clip">
      <JsonLd data={organizationJsonLd(locale as Locale)} />

      {/* ---------------------------------------------------------------- hero */}
      <section className="relative">
        {/* Washes of colour, faded out with a mask rather than clipped by the
            section edge - clipping left a hard horizontal line where the hero
            ended, visible in both themes. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        >
          <div className="bg-brand-soft/50 absolute -top-40 right-[-8rem] size-[34rem] rounded-full blur-3xl" />
          <div className="bg-brand-sage/35 absolute top-40 left-[-12rem] size-[28rem] rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pt-12 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-28">
          <div>
            <p
              className="glowa-enter bg-card/70 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.7rem] font-semibold tracking-[0.22em] uppercase backdrop-blur"
              style={delay(0)}
            >
              <span className="relative flex size-1.5">
                <span className="bg-primary absolute inset-0 animate-ping rounded-full opacity-70" />
                <span className="bg-primary relative size-1.5 rounded-full" />
              </span>
              {t("eyebrow")}
            </p>

            <h1 className="font-heading mt-6 text-[2.6rem] leading-[1.04] text-balance sm:text-6xl">
              <span className="glowa-enter block" style={delay(80)}>
                {t("titleLine1")}
              </span>
              <span className="glowa-enter relative inline-block" style={delay(200)}>
                <span className="text-primary">{t("titleLine2")}</span>
                <svg
                  aria-hidden
                  viewBox="0 0 300 12"
                  preserveAspectRatio="none"
                  className="text-primary/45 absolute -bottom-2 left-0 h-3 w-full"
                >
                  <path
                    d="M2 9 C 60 3, 140 3, 298 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    pathLength={1}
                    className="[stroke-dasharray:1] [stroke-dashoffset:1] motion-safe:animate-[glowa-draw_1.2s_0.8s_var(--ease-glowa)_forwards] motion-reduce:[stroke-dashoffset:0]"
                  />
                </svg>
              </span>
            </h1>

            <p
              className="glowa-enter text-muted-foreground mt-7 max-w-xl text-base leading-relaxed text-pretty sm:text-lg"
              style={delay(320)}
            >
              {t("subtitle")}
            </p>

            <div
              className="glowa-enter glowa-card mt-8 max-w-xl rounded-2xl p-2.5 shadow-[var(--shadow-lift)] sm:p-3"
              style={delay(440)}
            >
              <SearchForm cities={cities} variant="hero" examples={examples} />
            </div>

            <div
              className="glowa-enter mt-4 flex max-w-xl flex-wrap items-center gap-2 text-sm"
              style={delay(540)}
            >
              <span className="text-muted-foreground mr-1">{t("popular")}</span>
              {QUICK_PICKS.map((key) => (
                <Link
                  key={key}
                  href={`/search?q=${encodeURIComponent(t(`quick.${key}`))}`}
                  className="glowa-focus bg-card/70 hover:border-primary/50 hover:text-primary rounded-full border px-3 py-1 text-xs font-medium backdrop-blur transition-colors"
                >
                  {t(`quick.${key}`)}
                </Link>
              ))}
            </div>

            <ul
              className="glowa-enter text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm"
              style={delay(640)}
            >
              {badges.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-center gap-2">
                  <Icon className="text-primary size-4" aria-hidden />
                  {t(`badges.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          <HeroShowcase />
        </div>
      </section>

      {/* -------------------------------------------------------- marquee strip */}
      <section
        aria-label={t("popular")}
        className="border-border/60 bg-card/40 relative overflow-hidden border-y py-4"
      >
        <div className="glowa-marquee flex w-max gap-3 hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex gap-3" aria-hidden={copy === 1}>
              {[...QUICK_PICKS, ...QUICK_PICKS].map((key, index) => (
                <li key={`${key}-${index}`}>
                  <Link
                    href={`/search?q=${encodeURIComponent(t(`quick.${key}`))}`}
                    tabIndex={copy === 1 ? -1 : undefined}
                    className="font-heading text-muted-foreground hover:text-primary flex items-center gap-3 px-2 text-xl whitespace-nowrap transition-colors sm:text-2xl"
                  >
                    {t(`quick.${key}`)}
                    <Sparkles className="text-primary/60 size-4" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
        <div
          aria-hidden
          className="from-background pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r to-transparent"
        />
        <div
          aria-hidden
          className="from-background pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l to-transparent"
        />
      </section>

      {/* ---------------------------------------------------------- categories */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="glowa-reveal mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
              {t("categories.eyebrow")}
            </p>
            <h2 className="font-heading mt-3 text-3xl leading-tight text-balance sm:text-5xl">
              {t("categories.title")}
            </h2>
            <p className="text-muted-foreground mt-3 text-pretty">{t("categories.subtitle")}</p>
          </div>
        </div>
        <CategoryGrid />
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section className="relative">
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="glowa-reveal mx-auto max-w-2xl text-center">
            <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
              {t("how.eyebrow")}
            </p>
            <h2 className="font-heading mt-4 text-3xl leading-tight text-balance sm:text-5xl">
              {t("how.title")}
            </h2>
            <p className="text-muted-foreground mt-4 text-pretty">{t("how.subtitle")}</p>
          </div>

          <ol className="relative mt-14 grid gap-5 md:grid-cols-3">
            {/* The thread that ties the three steps together. */}
            <div
              aria-hidden
              className="via-primary/40 absolute top-10 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent to-transparent md:block"
            />
            {steps.map(({ key, icon: Icon }, index) => (
              <li
                key={key}
                // Side by side on a phone: three centred cards stacked were a
                // screen and a half of scrolling for three sentences.
                className="glowa-reveal glowa-card glowa-lift relative flex items-start gap-4 rounded-3xl p-5 sm:p-7 md:block md:text-center"
              >
                <span className="bg-primary text-primary-foreground relative flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-lift)] md:mx-auto md:size-14">
                  <Icon className="size-5 md:size-6" aria-hidden />
                  <span className="bg-card text-foreground absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border text-xs font-semibold">
                    {index + 1}
                  </span>
                </span>
                <div>
                  <h3 className="font-heading text-lg md:mt-5 md:text-xl">
                    {t(`how.${key}.title`)}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed md:mt-2">
                    {t(`how.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ featured */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <div className="glowa-reveal mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl">{t("featured.title")}</h2>
              <p className="text-muted-foreground mt-2">{t("featured.subtitle")}</p>
            </div>
            <Button asChild variant="outline" className="group rounded-full">
              <Link href="/search">
                {t("featured.all")}
                <ArrowRight
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((business) => (
              <div key={business.id} className="glowa-reveal">
                <BusinessCard business={business} locale={locale as Locale} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- for business */}
      <section className="bg-brand-ink text-brand-cream relative overflow-hidden dark:bg-[#141a19] dark:text-[#f7f2ed]">
        <div
          aria-hidden
          className="bg-primary/25 pointer-events-none absolute -top-32 right-[-6rem] size-[30rem] rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="glowa-reveal">
            <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
              {t("business.eyebrow")}
            </p>
            <h2 className="font-heading mt-4 text-3xl leading-tight text-balance sm:text-5xl">
              {t("business.title")}
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-pretty opacity-75">
              {t("business.body")}
            </p>

            <ul className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {FEATURES.slice(0, 6).map((key) => {
                const Icon = FEATURE_ICONS[key];
                return (
                  <li key={key} className="flex gap-3">
                    <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{t(`features.${key}.title`)}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed opacity-65">
                        {t(`features.${key}.body`)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group h-12 rounded-full px-6">
                <Link href={ownerHref}>
                  {t("business.cta")}
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 rounded-full px-6 text-current hover:bg-white/10 hover:text-current"
              >
                <Link href="/pricing">{t("business.secondary")}</Link>
              </Button>
            </div>
            {fromPrice ? (
              <p className="mt-4 text-sm opacity-70">
                {t("business.fromPrice", { price: fromPrice })}
              </p>
            ) : null}
          </div>

          <div className="glowa-reveal relative">
            <div className="absolute -inset-6 -z-0 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent blur-2xl" />
            <div className="relative text-[var(--foreground)]">
              <BusinessShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- growth */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="glowa-reveal relative aspect-[4/5] overflow-hidden rounded-[2rem] sm:aspect-[3/2] lg:aspect-[4/5]">
            <Image
              src={brandAssets.heroMobile}
              alt={t("heroAlt")}
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-glowa)] hover:scale-[1.03]"
            />
          </div>

          <div className="glowa-reveal">
            <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
              {t("growth.eyebrow")}
            </p>
            <h2 className="font-heading mt-4 text-3xl leading-tight text-balance sm:text-5xl">
              {t("growth.title")}
            </h2>
            <p className="text-muted-foreground mt-5 leading-relaxed text-pretty">
              {t("growth.body")}
            </p>

            <ul className="mt-7 space-y-3.5">
              {["point1", "point2", "point3"].map((point) => (
                <li key={point} className="flex items-start gap-3 text-[0.95rem]">
                  <span className="bg-primary/12 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  {t(`growth.${point}`)}
                </li>
              ))}
            </ul>

            {/* What GLOWA commits to, stated plainly. Still no invented
                traction: a promise is something we control, a customer count
                is not. */}
            <div className="glowa-card mt-10 flex gap-4 rounded-2xl p-5">
              <GlowaMark className="size-9 shrink-0" />
              <div>
                <Badge variant="secondary" className="mb-2">
                  {t("foundation.status")}
                </Badge>
                <h3 className="font-heading text-lg">{t("foundation.title")}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {t("foundation.body")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- final CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
        <div className="glowa-reveal from-primary relative overflow-hidden rounded-[2rem] bg-gradient-to-br to-[#b9554b] px-6 py-14 text-center text-white sm:px-12 sm:py-20 dark:to-[#8f3f37]">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -bottom-28 size-80 rounded-full bg-black/10 blur-3xl"
          />
          <GlowaMark monochrome className="relative mx-auto size-12 text-white/90" />
          <h2 className="font-heading relative mx-auto mt-6 max-w-2xl text-3xl leading-tight text-balance sm:text-5xl">
            {t("final.title")}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-white/85">
            {t("final.body")}
          </p>
          <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="text-primary h-12 rounded-full bg-white px-7 hover:bg-white/90"
            >
              <Link href="/search">
                <MapPin className="size-4" aria-hidden />
                {t("final.ctaCustomer")}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/50 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={ownerHref}>{t("final.ctaBusiness")}</Link>
            </Button>
          </div>
          <p className="relative mt-8 text-xs tracking-wide text-white/70">{brand("madeIn")}</p>
        </div>
      </section>
    </main>
  );
}
