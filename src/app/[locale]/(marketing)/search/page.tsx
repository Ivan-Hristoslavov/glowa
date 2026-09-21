import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { BusinessCard } from "@/components/discovery/business-card";
import { SearchForm } from "@/components/discovery/search-form";
import type { Locale } from "@/i18n/routing";
import { isBusinessCategory } from "@/lib/business-categories";
import { listCities, searchBusinesses } from "@/lib/queries/discovery";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("search");
  return { title: t("title"), description: t("subtitle") };
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

  const [cities, results] = await Promise.all([
    listCities(),
    searchBusinesses({ query, category, city }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mt-6">
        <SearchForm
          cities={cities}
          defaultQuery={query}
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
          {results.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              locale={locale as Locale}
            />
          ))}
        </div>
      )}
    </main>
  );
}
