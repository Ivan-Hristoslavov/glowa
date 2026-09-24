"use client";

import { Check, Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Locale } from "@/i18n/routing";
import { coarsen, findPlace, searchPlaces } from "@/lib/places";
import { cn } from "@/lib/utils";

export type PlaceValue =
  | { kind: "place"; id: string }
  | { kind: "near"; lat: number; lng: number }
  | null;

/** URL params for a chosen place: an id for a town, a coarse point for "near me". */
export function placeParams(value: PlaceValue) {
  if (!value) return {};
  if (value.kind === "place") return { place: value.id };
  return { near: `${value.lat},${value.lng}` };
}

type PlacePickerProps = {
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  /** Rendered as the trigger's contents; the picker owns the button. */
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
};

/**
 * Where, for someone who may live anywhere.
 *
 * Every town is listed, typed in any of the three spellings, and "near me"
 * asks the browser only when pressed - a permission prompt nobody asked for
 * is the quickest way to be blocked for good. The position is coarsened to
 * about a kilometre before it leaves this component.
 */
export function PlacePicker({ value, onChange, children, className, align = "start" }: PlacePickerProps) {
  const t = useTranslations("places");
  const locale = useLocale() as Locale;
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const country = locale === "ro" ? "RO" : "BG";
  const results = useMemo(() => searchPlaces(query, country, 8), [query, country]);

  function pick(next: PlaceValue) {
    onChange(next);
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocateError(t("locateUnsupported"));
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        pick({
          kind: "near",
          lat: coarsen(position.coords.latitude),
          lng: coarsen(position.coords.longitude),
        });
      },
      (error) => {
        setLocating(false);
        setLocateError(
          error.code === error.PERMISSION_DENIED ? t("locateDenied") : t("locateFailed"),
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const place = results[active];
      if (place) pick({ kind: "place", id: place.id });
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setLocateError(null);
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={className}>
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 rounded-2xl p-2">
        <div className="bg-muted/70 flex items-center gap-2 rounded-xl px-3">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            aria-controls={listId}
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>

        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="hover:bg-primary/10 text-primary mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className="size-4" aria-hidden />
          )}
          {locating ? t("locating") : t("nearMe")}
        </button>
        {locateError ? (
          <p className="text-muted-foreground px-3 pb-1 text-xs">{locateError}</p>
        ) : null}

        <ul id={listId} role="listbox" className="mt-1 max-h-72 overflow-y-auto">
          {value ? (
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className="text-muted-foreground hover:bg-muted w-full rounded-xl px-3 py-2 text-left text-sm"
              >
                {t("anywhere")}
              </button>
            </li>
          ) : null}
          {results.length === 0 ? (
            <li className="text-muted-foreground px-3 py-3 text-sm">{t("noMatch")}</li>
          ) : (
            results.map((place, index) => {
              const selected = value?.kind === "place" && value.id === place.id;
              return (
                <li key={place.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick({ kind: "place", id: place.id })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm",
                      index === active ? "bg-muted" : "hover:bg-muted",
                    )}
                  >
                    <MapPin className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate font-medium">{place.name[locale]}</span>
                    <span className="text-muted-foreground text-xs">
                      {place.country === "BG" ? t("bulgaria") : t("romania")}
                    </span>
                    {selected ? <Check className="text-primary size-4" aria-hidden /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** The label for a chosen place, in the visitor's language. */
export function usePlaceLabel(value: PlaceValue) {
  const t = useTranslations("places");
  const locale = useLocale() as Locale;
  if (!value) return null;
  if (value.kind === "near") return t("nearYou");
  return findPlace(value.id)?.name[locale] ?? null;
}
