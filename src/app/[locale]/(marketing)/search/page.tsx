import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { BusinessCard } from "@/components/discovery/business-card";
import { SearchForm } from "@/components/discovery/search-form";
import type { Locale } from "@/i18n/routing";
import { isBusinessCategory } from "@/lib/business-categories";
import { listCities, searchBusinesses } from "@/lib/queries/discovery";
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

  const rawSort = firstParam(sp.sort);
  const sort =
    rawSort === "price" || rawSort === "name" ? rawSort : ("rating" as const);

  const [cities, results] = await Promise.all([
    listCities(),
    searchBusinesses({ query, category, city, maxPriceCents, openOn, sort }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="glowa-enter space-y-2">
        <h1 className="font-heading text-3xl sm:text-5xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-6">
        <SearchForm
          cities={cities}
          defaultQuery={query}
          defaultMaxPrice={maxPriceCents ? String(maxPriceCents) : undefined}
          defaultOpenOn={openOn}
          defaultSort={sort}
          defaultCategory={category}
          defaultCity={city}
        />
      </div>

      <p className="text-muted-foreground mt-6 text-sm" aria-live="polite">
        {t("results", { count: results.length })}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t("noResults")}
          body={t("noResultsBody")}
          className="mt-4"
        />
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((business, index) => (
            <div
              key={business.id}
              className="glowa-enter"
              style={{ "--delay": `${Math.min(index, 8) * 60}ms` } as React.CSSProperties}
            >
              <BusinessCard business={business} locale={locale as Locale} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
