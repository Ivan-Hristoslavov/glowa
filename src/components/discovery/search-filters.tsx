"use client";

import { ArrowUpDown, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { cn } from "@/lib/utils";

/** Euro ceilings, in cents. Four honest brackets beat a slider on a phone. */
const PRICE_STEPS = [2000, 4000, 6000, 10000] as const;
type Sort = "rating" | "price" | "name" | "distance";

/**
 * Filters as chips that apply the moment they are tapped - no "apply" button
 * to find, and every choice is visible without opening anything. The URL is
 * the state, so a filtered page can be shared and the back button works.
 */
export function SearchFilters({
  params,
  category,
  maxPrice,
  sort,
  canSortByDistance,
}: {
  /** Every current search param, so a chip changes one thing and keeps the rest. */
  params: Record<string, string>;
  category?: string;
  maxPrice?: number;
  sort: Sort;
  canSortByDistance: boolean;
}) {
  const t = useTranslations("search");
  const categories = useTranslations("categories");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => {
      router.push(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    });
  }

  const chip = (active: boolean) =>
    cn(
      "glowa-focus inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
      active
        ? "border-foreground bg-foreground text-background"
        : "bg-card hover:border-foreground/30",
    );

  const sorts: Sort[] = canSortByDistance
    ? ["distance", "rating", "price", "name"]
    : ["rating", "price", "name"];
  const hasFilters = Boolean(category || maxPrice);

  return (
    <div className={cn("space-y-3 transition-opacity", isPending && "opacity-60")}>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button
          type="button"
          onClick={() => set({ category: null })}
          className={chip(!category)}
        >
          {t("allCategories")}
        </button>
        {BUSINESS_CATEGORIES.filter((key) => key !== "other").map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => set({ category: category === key ? null : key })}
            aria-pressed={category === key}
            className={chip(category === key)}
          >
            {categories(key)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRICE_STEPS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => set({ maxPrice: maxPrice === cents ? null : String(cents) })}
            aria-pressed={maxPrice === cents}
            className={chip(maxPrice === cents)}
          >
            {t("upTo", { amount: cents / 100 })}
          </button>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(chip(false), "ml-auto")}>
              <ArrowUpDown className="size-3.5" aria-hidden />
              {t(`sortBy.${sort}`)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            {sorts.map((option) => (
              <DropdownMenuItem key={option} onClick={() => set({ sort: option })}>
                <Check
                  className={cn("size-4", option === sort ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                {t(`sortBy.${option}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => set({ category: null, maxPrice: null })}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            <X className="size-3.5" aria-hidden />
            {t("clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
