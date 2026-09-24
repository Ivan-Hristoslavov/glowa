import { ArrowRight, Check, LayoutGrid } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { GlowaMark } from "@/components/brand/glowa-logo";
import { JsonLd } from "@/components/common/json-ld";
import { BusinessCard } from "@/components/discovery/business-card";
import { ArchCollage } from "@/components/discovery/arch-collage";
import { HeroSearch } from "@/components/discovery/hero-search";
import { LiveOpenings } from "@/components/discovery/live-openings";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { categoryImages, showcaseAssets } from "@/lib/brand-assets";
import type { BusinessCategory } from "@/lib/business-categories";
import { searchBusinesses } from "@/lib/queries/discovery";
import { organizationJsonLd } from "@/lib/seo/structured-data";

/** Categories as round portraits under the search - one tap each. */
const CIRCLES: Array<{ category: BusinessCategory; image: string }> = [
  { category: "hair_salon", image: categoryImages.hair },
  { category: "barbershop", image: categoryImages.barber },
  { category: "nail_studio", image: categoryImages.nails },
  { category: "lash_brow", image: categoryImages.lashes },
  { category: "skincare", image: categoryImages.skincare },
  { category: "spa", image: categoryImages.spa },
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
  const categories = await getTranslations("categories");
  const featured = await searchBusinesses({ limit: 6 });

  const promises = ["noCommission", "noCompetitors", "dataYours", "directPayouts"] as const;

  return (
    <main>
      <JsonLd data={organizationJsonLd(locale as Locale)} />

      {/* ---------------------------------------------------------------- hero */}
      {/* GLOWA's own shape: arched frames, the silhouette of a salon mirror,
          lit by a warm peach glow. Words left, pictures right, and the search
          docked under both so it reads as the next step, not a banner. */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-brand-peach absolute -top-32 right-[-10rem] size-[40rem] rounded-full opacity-70 blur-3xl" />
          <div className="bg-brand-soft/50 absolute top-40 -left-40 size-[28rem] rounded-full blur-3xl" />
          <div className="from-background absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
            <Reveal>
              <p className="bg-card/80 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur">
                <span className="bg-primary size-1.5 rounded-full" aria-hidden />
                {t("pill")}
              </p>
              <h1 className="font-heading mt-6 text-[clamp(2.1rem,10.5vw,2.75rem)] leading-[1.02] text-balance sm:text-[4.25rem]">
                {t("titleLine1")}{" "}
                <span className="relative inline-block whitespace-nowrap">
                  <span className="relative z-10">{t("titleLine2")}</span>
                  {/* The glow stroke under the promise. */}
                  <span
                    aria-hidden
                    className="bg-primary/25 absolute inset-x-[-0.1em] bottom-[0.08em] z-0 h-[0.32em] rounded-full"
                  />
                </span>
              </h1>
              <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed text-pretty">
                {t("subtitle")}
              </p>
            </Reveal>

            <Reveal delay={0.1} className="relative hidden h-[30rem] md:block">
              <ArchCollage labels={{ instant: t("chips.instant"), refund: t("chips.refund") }} />
            </Reveal>
          </div>

          <Reveal delay={0.15} className="relative z-10 mt-10 lg:-mt-6">
            <HeroSearch />
          </Reveal>

          {/* Categories as round portraits: one tap each, easy to thumb
              through on a phone. */}
          <Reveal delay={0.25}>
            <ul className="-mx-4 mt-10 flex gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:justify-between sm:px-0">
              {CIRCLES.map((circle) => (
                <li key={circle.category} className="shrink-0">
                  <Link
                    href={`/search?category=${circle.category}`}
                    className="glowa-focus group flex w-20 flex-col items-center gap-2 rounded-2xl sm:w-24"
                  >
                    <span className="from-primary to-brand-peach rounded-full bg-gradient-to-tr p-[3px] transition-transform duration-300 group-hover:scale-105">
                      <span className="border-background relative block size-[4.5rem] overflow-hidden rounded-full border-[3px] sm:size-20">
                        <Image src={circle.image} alt="" fill sizes="80px" className="object-cover" />
                      </span>
                    </span>
                    <span className="text-center text-xs leading-tight font-medium sm:text-sm">
                      {categories(circle.category)}
                    </span>
                  </Link>
                </li>
              ))}
              <li className="shrink-0">
                <Link
                  href="/search"
                  className="glowa-focus group flex w-20 flex-col items-center gap-2 rounded-2xl sm:w-24"
                >
                  <span className="border-primary/30 flex size-[4.9rem] items-center justify-center rounded-full border-2 border-dashed transition-transform duration-300 group-hover:scale-105 sm:size-[5.4rem]">
                    <LayoutGrid className="text-primary size-6" aria-hidden />
                  </span>
                  <span className="text-center text-xs leading-tight font-medium sm:text-sm">
                    {t("allCategories")}
                  </span>
                </Link>
              </li>
            </ul>
          </Reveal>

          <p className="text-muted-foreground pt-4 pb-16 text-sm">
            {t("ownerPrompt")}{" "}
            <Link
              href="/for-business"
              className="text-foreground glowa-focus rounded font-semibold underline decoration-[var(--primary)] decoration-2 underline-offset-4"
            >
              {t("ownerLink")}
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- live openings */}
      <LiveOpenings />

      {/* ------------------------------------------------------------ featured */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl">{t("featured.title")}</h2>
              <p className="text-muted-foreground mt-2">{t("featured.subtitle")}</p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/search">
                {t("featured.all")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <Stagger onView className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((business) => (
              <StaggerItem key={business.id}>
                <BusinessCard business={business} locale={locale as Locale} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ) : null}

      {/* ------------------------------------------------------ for businesses */}
      <section className="px-4 pb-20 sm:px-6">
        <Reveal onView>
          <div className="bg-foreground text-background relative mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] lg:grid-cols-2">
            <div className="relative z-10 p-8 sm:p-12 lg:p-14">
              <p className="text-xs font-semibold tracking-[0.2em] text-[var(--glowa-soft)] uppercase">
                {t("business.eyebrow")}
              </p>
              <h2 className="font-heading mt-4 text-3xl leading-tight text-balance sm:text-5xl">
                {t("business.title")}
              </h2>
              <p className="text-background/75 mt-4 max-w-md text-lg leading-relaxed">
                {t("business.body")}
              </p>
              <ul className="mt-6 space-y-2.5">
                {(["point1", "point2", "point3"] as const).map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <Check className="text-primary mt-1 size-4 shrink-0" aria-hidden />
                    <span className="text-background/90">{t(`business.${point}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <Link href="/signup">
                    {t("ctaPrimary")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-background hover:bg-background/10 hover:text-background h-12 rounded-full px-6 text-base"
                >
                  <Link href="/for-business">{t("business.more")}</Link>
                </Button>
              </div>
            </div>
            <div className="relative min-h-72 lg:min-h-full">
              <Image
                src={showcaseAssets.cover}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="from-foreground absolute inset-0 bg-gradient-to-b to-transparent lg:bg-gradient-to-r" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* What GLOWA commits to, stated plainly. Still no invented traction:
          a promise is something we control, a customer count is not. */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
        <div className="flex items-center gap-3">
          <GlowaMark className="size-9 shrink-0" />
          <h2 className="font-heading text-2xl sm:text-3xl">{t("foundation.title")}</h2>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map((key) => (
            <li key={key} data-glow className="glowa-card glowa-glow rounded-2xl p-5">
              <p className="font-semibold">{t(`promises.${key}.title`)}</p>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {t(`promises.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
