import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/common/json-ld";
import { BusinessCard } from "@/components/discovery/business-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { searchBusinesses } from "@/lib/queries/discovery";
import {
  LANDING_CATEGORIES,
  categoryFromSlug,
  categoryToSlug,
  landingPath,
  inPreposition,
  landingPlace,
  topPlaces,
} from "@/lib/seo/landing";
import { alternatesFor, breadcrumbJsonLd } from "@/lib/seo/structured-data";

/** Built on first request and kept an hour; the sitemap lists the ones worth crawling. */
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

async function load(category: string, city: string, locale: Locale) {
  const type = categoryFromSlug(category);
  const place = landingPlace(city);
  if (!type || !place) return null;

  // Salons in this town first; if there are none, the nearest, so the page
  // is never a dead end - and is kept out of the index, because a page with
  // no salon on it has nothing to offer a search engine.
  const here = await searchBusinesses({
    category: type,
    city: place.name.bg,
    sort: "rating",
    limit: 24,
  });
  const results =
    here.length > 0
      ? here
      : await searchBusinesses({
          category: type,
          near: { lat: place.lat, lng: place.lng },
          sort: "distance",
          limit: 6,
        });
  return { type, place, results, hasLocal: here.length > 0, locale };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/salons/[category]/[city]">): Promise<Metadata> {
  const { locale, category, city } = await params;
  const data = await load(category, city, locale as Locale);
  if (!data) return {};

  const t = await getTranslations({ locale, namespace: "landing" });
  const categories = await getTranslations({ locale, namespace: "categories" });
  const vars = {
    category: categories(data.type),
    categoryLower: categories(data.type).toLocaleLowerCase(locale),
    city: data.place.name[locale as Locale],
    prep: inPreposition(locale, data.place.name[locale as Locale]),
  };
  return {
    title: t("metaTitle", vars),
    description: t("metaDescription", vars),
    alternates: alternatesFor(`/${locale}${landingPath(data.type, data.place)}`),
    robots: { index: data.hasLocal, follow: true },
  };
}

export default async function LandingPage({
  params,
}: PageProps<"/[locale]/salons/[category]/[city]">) {
  const { locale, category, city } = await params;
  setRequestLocale(locale);
  const activeLocale = locale as Locale;

  const data = await load(category, city, activeLocale);
  if (!data) notFound();

  const t = await getTranslations("landing");
  const categories = await getTranslations("categories");
  const placeName = data.place.name[activeLocale];
  const vars = {
    category: categories(data.type),
    categoryLower: categories(data.type).toLocaleLowerCase(locale),
    city: placeName,
    prep: inPreposition(locale, placeName),
  };

  const otherCategories = LANDING_CATEGORIES.filter((item) => item !== data.type);
  const otherPlaces = topPlaces(data.place.country, 10).filter(
    (item) => item.id !== data.place.id,
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd
        data={breadcrumbJsonLd(activeLocale, [
          { name: "GLOWA", path: "" },
          { name: categories(data.type), path: "/search?category=" + data.type },
          { name: placeName, path: landingPath(data.type, data.place) },
        ])}
      />

      <h1 className="font-heading text-3xl text-balance sm:text-5xl">{t("h1", vars)}</h1>
      <p className="text-muted-foreground mt-4 max-w-2xl text-lg leading-relaxed text-pretty">
        {t("intro", vars)}
      </p>

      <ul className="text-muted-foreground mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {(["live", "rules", "free"] as const).map((key) => (
          <li key={key} className="flex items-center gap-2">
            <span className="bg-primary size-1.5 rounded-full" aria-hidden />
            {t(`points.${key}`)}
          </li>
        ))}
      </ul>

      <section className="mt-10" aria-live="polite">
        {data.hasLocal ? (
          <p className="text-muted-foreground mb-5 text-sm">
            {t("count", { count: data.results.length, city: placeName, prep: vars.prep })}
          </p>
        ) : (
          <div className="bg-secondary/50 mb-6 rounded-2xl p-5">
            <p className="font-semibold">{t("noneTitle", vars)}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t("noneBody")}</p>
          </div>
        )}
        {data.results.length > 0 ? (
          <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {data.results.map((business) => (
              <BusinessCard key={business.id} business={business} locale={activeLocale} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-16">
        <h2 className="font-heading text-2xl">{t("otherCategories", { city: placeName, prep: vars.prep })}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {otherCategories.map((item) => (
            <li key={item}>
              <Link
                href={landingPath(item, data.place)}
                className="glowa-focus hover:bg-accent inline-block rounded-full border px-4 py-2 text-sm"
              >
                {categories(item)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-2xl">{t("otherPlaces", vars)}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {otherPlaces.map((item) => (
            <li key={item.id}>
              <Link
                href={`/salons/${categoryToSlug(data.type)}/${item.id}`}
                className="glowa-focus hover:bg-accent inline-block rounded-full border px-4 py-2 text-sm"
              >
                {item.name[activeLocale]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-foreground text-background mt-16 flex flex-col gap-4 rounded-3xl p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="font-heading text-2xl">{t("ownerTitle", vars)}</p>
          <p className="text-background/75 mt-1">{t("ownerBody")}</p>
        </div>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/for-business">{t("ownerCta")}</Link>
        </Button>
      </section>
    </main>
  );
}
