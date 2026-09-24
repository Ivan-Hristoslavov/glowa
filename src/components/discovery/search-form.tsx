"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useTypingPlaceholder } from "@/components/discovery/use-typing-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useRouter } from "@/i18n/navigation";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { cn } from "@/lib/utils";

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
  /** Example searches typed into the empty field (hero only). */
  examples?: string[];
};

/**
 * Price ceilings in euro. A slider looks clever and is miserable on a phone;
 * four honest brackets are what people actually pick.
 */
const PRICE_STEPS = [2000, 4000, 6000, 10000] as const;
const SORTS = ["rating", "price", "name"] as const;

/** YYYY-MM-DD in the visitor's own calendar, `days` from today. */
function localDateKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function SearchForm({
  cities,
  defaultQuery = "",
  defaultCategory,
  defaultCity,
  defaultMaxPrice,
  defaultOpenOn,
  defaultSort,
  variant = "full",
  examples,
}: SearchFormProps) {
  const t = useTranslations("search");
  const common = useTranslations("common");
  const categories = useTranslations("categories");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(defaultQuery);
  const [focused, setFocused] = useState(false);
  const [phrases] = useState(() => examples ?? []);
  const typed = useTypingPlaceholder(phrases, !focused && !query);
  const [category, setCategory] = useState(defaultCategory ?? ANY);
  const [city, setCity] = useState(defaultCity ?? ANY);
  const [maxPrice, setMaxPrice] = useState(defaultMaxPrice ?? ANY);
  const [openOn, setOpenOn] = useState(defaultOpenOn ?? "");
  const [sort, setSort] = useState(defaultSort ?? "rating");
  const [sheetOpen, setSheetOpen] = useState(false);

  // A salon cannot be booked in the past, and 90 days is the schema's own
  // maximum lead time. Read once rather than on every render: a clock read
  // during render is exactly what the compiler rules forbid.
  const [[today, tomorrow, latest]] = useState(() => [
    localDateKey(0),
    localDateKey(1),
    localDateKey(90),
  ]);

  const activeFilterCount =
    Number(city !== ANY) + Number(maxPrice !== ANY) + Number(Boolean(openOn)) + Number(sort !== "rating");

  const hasFilters = Boolean(query) || category !== ANY || activeFilterCount > 0;

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
      router.push(search ? `/search?${search}` : "/search", { scroll: false });
    });
  }

  function clear() {
    setQuery("");
    setCategory(ANY);
    setCity(ANY);
    setMaxPrice(ANY);
    setOpenOn("");
    setSort("rating");
    startTransition(() => router.push("/search", { scroll: false }));
  }

  const chipClass = (active: boolean) =>
    cn(
      "glowa-focus shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-300",
      active
        ? "border-primary bg-primary text-primary-foreground shadow-primary/25 shadow-md"
        : "bg-card hover:border-primary/50 hover:text-primary",
    );

  /**
   * City, price, day and sort. The same controls render inline on a wide
   * screen and inside a bottom sheet on a phone, where five stacked selects
   * used to push the first result below the fold.
   */
  const filters = (layout: "row" | "stack") => (
    <div
      className={cn(
        layout === "row"
          ? "flex flex-wrap items-center gap-2"
          : "flex flex-col gap-5",
      )}
    >
      <FilterField label={t("city")} layout={layout}>
        <Select
          value={city}
          onValueChange={(value) => {
            setCity(value);
            if (layout === "row") submit({ city: value });
          }}
        >
          <SelectTrigger
            className={cn("h-10 rounded-full", layout === "row" ? "w-44" : "w-full")}
            aria-label={t("city")}
          >
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
      </FilterField>

      <FilterField label={t("maxPrice")} layout={layout}>
        <Select
          value={maxPrice}
          onValueChange={(value) => {
            setMaxPrice(value);
            if (layout === "row") submit({ maxPrice: value });
          }}
        >
          <SelectTrigger
            className={cn("h-10 rounded-full", layout === "row" ? "w-40" : "w-full")}
            aria-label={t("maxPrice")}
          >
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
      </FilterField>

      {/* Deliberately "open on", not "free at": the server filters by opening
          hours and staff availability, and does not claim to have found an
          empty slot. Today and tomorrow are one tap; anything else is a date
          field. */}
      <FilterField label={t("openOn")} layout={layout}>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { value: "", label: t("anyDay") },
            { value: today, label: common("today") },
            { value: tomorrow, label: common("tomorrow") },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={openOn === option.value}
              onClick={() => {
                setOpenOn(option.value);
                if (layout === "row") submit({ openOn: option.value });
              }}
              className={chipClass(openOn === option.value)}
            >
              {option.label}
            </button>
          ))}
          <Input
            type="date"
            value={openOn && openOn !== today && openOn !== tomorrow ? openOn : ""}
            min={today}
            max={latest}
            aria-label={t("otherDay")}
            title={t("otherDay")}
            className="h-9 w-40 rounded-full"
            onChange={(event) => {
              setOpenOn(event.target.value);
              if (layout === "row") submit({ openOn: event.target.value });
            }}
          />
        </div>
      </FilterField>

      <FilterField label={t("sort")} layout={layout}>
        <Select
          value={sort}
          onValueChange={(value) => {
            setSort(value);
            if (layout === "row") submit({ sort: value });
          }}
        >
          <SelectTrigger
            className={cn("h-10 rounded-full", layout === "row" ? "w-36" : "w-full")}
            aria-label={t("sort")}
          >
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
      </FilterField>
    </div>
  );

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={typed ? `${typed}|` : t("placeholder")}
            aria-label={t("placeholder")}
            className={cn(
              "pl-9",
              variant === "hero" ? "h-12 rounded-xl text-base" : "h-12 rounded-full",
            )}
            enterKeyHint="search"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className={cn(
            "h-12",
            variant === "hero" ? "glowa-shine rounded-xl px-6 text-base" : "rounded-full px-6",
          )}
          disabled={isPending}
        >
          <Search className="size-4" aria-hidden />
          <span className={variant === "hero" ? undefined : "sr-only sm:not-sr-only"}>
            {t("submit")}
          </span>
        </Button>

        {variant === "full" ? (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="relative h-12 rounded-full px-4 lg:hidden"
                aria-label={t("filters")}
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                {activeFilterCount > 0 ? (
                  <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[0.65rem] font-semibold">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl">
              <SheetHeader>
                <SheetTitle className="font-heading text-xl">{t("filtersTitle")}</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-2">{filters("stack")}</div>
              <div className="flex gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {hasFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={() => {
                      clear();
                      setSheetOpen(false);
                    }}
                  >
                    {t("clear")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    submit();
                    setSheetOpen(false);
                  }}
                >
                  {t("showResults")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>

      {variant === "full" ? (
        <>
          {/* Categories as one-tap chips: the most common filter should not
              hide behind a dropdown. Scrolls sideways on a phone. */}
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label={t("category")}
          >
            <button
              type="button"
              aria-pressed={category === ANY}
              onClick={() => {
                setCategory(ANY);
                submit({ category: ANY });
              }}
              className={chipClass(category === ANY)}
            >
              {t("allShort")}
            </button>
            {BUSINESS_CATEGORIES.filter((value) => value !== "other").map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => {
                  setCategory(value);
                  submit({ category: value });
                }}
                className={chipClass(category === value)}
              >
                {categories(value)}
              </button>
            ))}
          </div>

          <div className="hidden items-center justify-between gap-3 lg:flex">
            {filters("row")}
            {hasFilters ? (
              <Button type="button" variant="ghost" onClick={clear} className="shrink-0">
                <X className="size-4" aria-hidden />
                {t("clear")}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </form>
  );
}

function FilterField({
  label,
  layout,
  children,
}: {
  label: string;
  layout: "row" | "stack";
  children: React.ReactNode;
}) {
  if (layout === "row") return <>{children}</>;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
