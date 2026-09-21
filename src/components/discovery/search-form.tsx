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
  /** Compact single-field variant used on the landing page. */
  variant?: "full" | "hero";
};

export function SearchForm({
  cities,
  defaultQuery = "",
  defaultCategory,
  defaultCity,
  variant = "full",
}: SearchFormProps) {
  const t = useTranslations("search");
  const categories = useTranslations("categories");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(defaultQuery);
  const [category, setCategory] = useState(defaultCategory ?? ANY);
  const [city, setCity] = useState(defaultCity ?? ANY);

  const hasFilters = Boolean(query) || category !== ANY || city !== ANY;

  function submit(next?: { category?: string; city?: string }) {
    const params = new URLSearchParams();
    const nextCategory = next?.category ?? category;
    const nextCity = next?.city ?? city;

    if (query.trim()) params.set("q", query.trim());
    if (nextCategory !== ANY) params.set("category", nextCategory);
    if (nextCity !== ANY) params.set("city", nextCity);

    const search = params.toString();
    startTransition(() => {
      router.push(search ? `/search?${search}` : "/search");
    });
  }

  function clear() {
    setQuery("");
    setCategory(ANY);
    setCity(ANY);
    startTransition(() => router.push("/search"));
  }

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
