"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";

const ANY = "__any__";

type SearchFormProps = {
  cities: string[];
  defaultQuery?: string;
  defaultCategory?: string;
  defaultCity?: string;
  defaultMaxPrice?: string;
  defaultOpenOn?: string;
  defaultSort?: string;
  /** Compact single-field variant used on the landing page. */
  variant?: "full" | "hero";
};

/**
 * Price ceilings in euro. A slider looks clever and is miserable on a phone;
 * four honest brackets are what people actually pick.
 */
const PRICE_STEPS = [2000, 4000, 6000, 10000] as const;
const SORTS = ["rating", "price", "name"] as const;

export function SearchForm({
  cities,
  defaultQuery = "",
  defaultCategory,
  defaultCity,
  defaultMaxPrice,
  defaultOpenOn,
  defaultSort,
  variant = "full",
}: SearchFormProps) {
  const t = useTranslations("search");
  const categories = useTranslations("categories");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(defaultQuery);
  const [category, setCategory] = useState(defaultCategory ?? ANY);
  const [city, setCity] = useState(defaultCity ?? ANY);
  const [maxPrice, setMaxPrice] = useState(defaultMaxPrice ?? ANY);
  const [openOn, setOpenOn] = useState(defaultOpenOn ?? "");
  const [sort, setSort] = useState(defaultSort ?? "rating");

  const hasFilters =
    Boolean(query) ||
    category !== ANY ||
    city !== ANY ||
    maxPrice !== ANY ||
    Boolean(openOn) ||
    sort !== "rating";

  function submit(next?: Partial<Record<string, string>>) {
    const params = new URLSearchParams();
    const nextCategory = next?.category ?? category;
    const nextCity = next?.city ?? city;
    const nextMaxPrice = next?.maxPrice ?? maxPrice;
    const nextOpenOn = next?.openOn ?? openOn;
    const nextSort = next?.sort ?? sort;

    if (query.trim()) params.set("q", query.trim());
    if (nextCategory !== ANY) params.set("category", nextCategory);
    if (nextCity !== ANY) params.set("city", nextCity);
    if (nextMaxPrice !== ANY) params.set("maxPrice", nextMaxPrice);
    if (nextOpenOn) params.set("openOn", nextOpenOn);
    if (nextSort !== "rating") params.set("sort", nextSort);

    const search = params.toString();
    startTransition(() => {
      router.push(search ? `/search?${search}` : "/search");
    });
  }

  function clear() {
    setQuery("");
    setCategory(ANY);
    setCity(ANY);
    setMaxPrice(ANY);
    setOpenOn("");
    setSort("rating");
    startTransition(() => router.push("/search"));
  }

  // A salon cannot be booked in the past, and 90 days is the schema's own
  // maximum lead time. Read once rather than on every render: a clock read
  // during render is exactly what the compiler rules forbid.
  const [[today, latest]] = useState(() => [
    new Date().toISOString().slice(0, 10),
    new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
  ]);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <div className="relative min-w-0 flex-1 sm:min-w-64">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="h-11 pl-9"
          enterKeyHint="search"
        />
      </div>

      {variant === "full" ? (
        <>
          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value);
              submit({ category: value });
            }}
          >
            <SelectTrigger className="h-11 sm:w-48" aria-label={t("category")}>
              <SelectValue placeholder={t("allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("allCategories")}</SelectItem>
              {BUSINESS_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {categories(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={city}
            onValueChange={(value) => {
              setCity(value);
              submit({ city: value });
            }}
          >
            <SelectTrigger className="h-11 sm:w-44" aria-label={t("city")}>
              <SelectValue placeholder={t("allCities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("allCities")}</SelectItem>
              {cities.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={maxPrice}
            onValueChange={(value) => {
              setMaxPrice(value);
              submit({ maxPrice: value });
            }}
          >
            <SelectTrigger className="h-11 sm:w-44" aria-label={t("maxPrice")}>
              <SelectValue placeholder={t("anyPrice")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("anyPrice")}</SelectItem>
              {PRICE_STEPS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {t("upTo", { amount: value / 100 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Deliberately "open on", not "free at": the server filters by
              opening hours and staff availability, and does not claim to have
              found an empty slot. */}
          <div className="flex flex-col gap-1">
            <Input
              type="date"
              value={openOn}
              min={today}
              max={latest}
              aria-label={t("openOn")}
              className="h-11 sm:w-44"
              onChange={(event) => {
                setOpenOn(event.target.value);
                submit({ openOn: event.target.value });
              }}
            />
          </div>

          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value);
              submit({ sort: value });
            }}
          >
            <SelectTrigger className="h-11 sm:w-40" aria-label={t("sort")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sortBy.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11 flex-1" disabled={isPending}>
          {t("submit")}
        </Button>
        {variant === "full" && hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-11"
            onClick={clear}
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("clear")}</span>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
