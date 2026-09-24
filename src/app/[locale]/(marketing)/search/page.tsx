import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { BusinessCard } from "@/components/discovery/business-card";
import { HeroSearch } from "@/components/discovery/hero-search";
import type { PlaceValue } from "@/components/discovery/place-picker";
import { SearchFilters } from "@/components/discovery/search-filters";
import type { Locale } from "@/i18n/routing";
import { isBusinessCategory } from "@/lib/business-categories";
import { findPlace, parseNear } from "@/lib/places";
import { searchBusinesses } from "@/lib/queries/discovery";
import { alternatesFor } from "@/lib/seo/structured-data";

/**
 * Results change as businesses join, not as visitors arrive. An hour keeps
 * the common queries on the cache and still reflects a new salon the same
 * afternoon.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: t("title"),
    description: t("subtitle"),
    // Without its own canonical this inherited the layout's `/bg`, which told
    // Google search was a duplicate of the home page.
    alternates: alternatesFor(`/${locale}/search`),
    // The filtered variants are the same page with a query string; indexing
    // them fills the index with near-duplicates.
    robots: { index: true, follow: true },
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({
  params,
  searchParams,
}: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("search");
  const sp = await searchParams;
  const activeLocale = locale as Locale;

  const query = firstParam(sp.q) ?? "";
  const rawCategory = firstParam(sp.category);
  const category = isBusinessCategory(rawCategory) ? rawCategory : undefined;
  const city = firstParam(sp.city);

  const rawMaxPrice = Number(firstParam(sp.maxPrice));
  const maxPriceCents =
    Number.isFinite(rawMaxPrice) && rawMaxPrice > 0 ? rawMaxPrice : undefined;

  // Anything that is not a plain YYYY-MM-DD is dropped rather than passed on
  // for Postgres to reject.
  const rawOpenOn = firstParam(sp.openOn);
  const openOn = rawOpenOn && /^\d{4}-\d{2}-\d{2}$/.test(rawOpenOn) ? rawOpenOn : undefined;

  // Where: a town from the list, or a coarse "near me" point.
  const place = findPlace(firstParam(sp.place));
  const near = place ? { lat: place.lat, lng: place.lng } : parseNear(firstParam(sp.near));
  const placeValue: PlaceValue = place
    ? { kind: "place", id: place.id }
    : near
      ? { kind: "near", lat: near.lat, lng: near.lng }
      : null;

  // With a place, nearest first unless the visitor asked for something else.
  const rawSort = firstParam(sp.sort);
  const sort =
    rawSort === "price" || rawSort === "name" || rawSort === "rating"
      ? rawSort
      : rawSort === "distance" || near
        ? near
          ? ("distance" as const)
          : ("rating" as const)
        : ("rating" as const);

  const results = await searchBusinesses({
    query,
    category,
    city,
    maxPriceCents,
    openOn,
    sort,
    near,
  });

  // A dead end helps nobody: when the filters leave nothing, show what is
  // nearest (or simply best rated) instead of an empty page.
  const fallback =
    results.length === 0
      ? await searchBusinesses({ near, sort: near ? "distance" : "rating", limit: 6 })
      : [];

  const current: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    const first = firstParam(value);
    if (first) current[key] = first;
  }
  const keep: Record<string, string> = {};
  if (category) keep.category = category;
  if (maxPriceCents) keep.maxPrice = String(maxPriceCents);
  if (rawSort) keep.sort = rawSort;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-heading text-3xl sm:text-4xl">
        {place
          ? t("titleNear", { place: place.name[activeLocale] })
          : near
            ? t("titleNearYou")
            : t("title")}
      </h1>

      <div className="mt-6">
        <HeroSearch
          // Remount when the URL changes, so the bar always shows the search
          // the results belong to.
          key={JSON.stringify([query, placeValue, openOn])}
          variant="bar"
          initial={{ q: query, place: placeValue, day: openOn }}
          keep={keep}
        />
      </div>

      <div className="mt-6">
        <SearchFilters
          params={current}
          category={category}
          maxPrice={maxPriceCents}
          sort={sort}
          canSortByDistance={Boolean(near)}
        />
      </div>

      <p className="text-muted-foreground mt-6 text-sm" aria-live="polite">
        {t("results", { count: results.length })}
        {sort === "distance" && place
          ? ` · ${t("sortedFrom", { place: place.name[activeLocale] })}`
          : sort === "distance" && near
            ? ` · ${t("sortedFromYou")}`
            : null}
      </p>

      {results.length === 0 ? (
        <div className="mt-4 space-y-10">
          <EmptyState icon={SearchX} title={t("noResults")} body={t("noResultsBody")} />
          {fallback.length > 0 ? (
            <section className="space-y-5">
              <h2 className="font-heading text-2xl">
                {near ? t("nearestInstead") : t("popularInstead")}
              </h2>
              <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
                {fallback.map((business) => (
                  <BusinessCard key={business.id} business={business} locale={activeLocale} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((business) => (
            <BusinessCard key={business.id} business={business} locale={activeLocale} />
          ))}
        </div>
      )}
    </main>
  );
}
