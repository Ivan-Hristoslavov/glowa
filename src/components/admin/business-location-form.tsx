"use client";

import { CheckCircle2, Loader2, LocateFixed, MapPin, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { updateBusinessLocation } from "@/lib/actions/business";
import { matchPlace, PLACES } from "@/lib/places";

type LocationDraft = {
  addressLine1: string;
  city: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
};

/** Five decimals is about a metre - the salon's door, which is public anyway. */
function round(value: number) {
  return Math.round(value * 1e5) / 1e5;
}

/**
 * The address clients read and the point "near me" sorts by.
 *
 * The point is the part owners forget, and without it a salon simply does not
 * appear for someone searching nearby. So the form says plainly whether the
 * salon is on the map, and one button - pressed while standing in the salon -
 * puts it there exactly. A known town's centre stands in until then.
 */
export function BusinessLocationForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: LocationDraft;
}) {
  const t = useTranslations("admin.location");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const listId = useId();
  const [draft, setDraft] = useState(initial);
  const [locating, setLocating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const country = locale === "ro" ? "RO" : "BG";
  const towns = PLACES.filter((place) => place.country === country);
  const town = matchPlace(draft.city);
  const pinned = draft.latitude !== null && draft.longitude !== null;
  // A point that is exactly a town's centre was not placed by hand.
  const approximate =
    pinned && town !== null && draft.latitude === town.lat && draft.longitude === town.lng;

  function patch(next: Partial<LocationDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error(t("locateFailed"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        patch({
          latitude: round(position.coords.latitude),
          longitude: round(position.coords.longitude),
        });
        toast.success(t("located"));
      },
      () => {
        setLocating(false);
        toast.error(t("locateFailed"));
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBusinessLocation({ businessId, ...draft });
      if (!result.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  const mapsUrl = pinned
    ? `https://www.google.com/maps/search/?api=1&query=${draft.latitude},${draft.longitude}`
    : null;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_0.8fr]">
        <div className="space-y-2">
          <Label htmlFor="location-address">{t("address")}</Label>
          <Input
            id="location-address"
            autoComplete="street-address"
            placeholder={t("addressPlaceholder")}
            value={draft.addressLine1}
            onChange={(event) => patch({ addressLine1: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location-city" required>
            {t("city")}
          </Label>
          <Input
            id="location-city"
            required
            list={listId}
            autoComplete="address-level2"
            value={draft.city}
            onChange={(event) => patch({ city: event.target.value })}
          />
          <datalist id={listId}>
            {towns.map((place) => (
              <option key={place.id} value={place.name[locale]} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location-postal">{t("postalCode")}</Label>
          <Input
            id="location-postal"
            autoComplete="postal-code"
            inputMode="numeric"
            value={draft.postalCode}
            onChange={(event) => patch({ postalCode: event.target.value })}
          />
        </div>
      </div>

      <div className="bg-muted/50 flex flex-wrap items-center gap-4 rounded-2xl border p-4">
        <span
          className={
            pinned && !approximate
              ? "bg-success/12 text-success flex size-10 shrink-0 items-center justify-center rounded-xl"
              : "bg-warning/14 text-warning flex size-10 shrink-0 items-center justify-center rounded-xl"
          }
        >
          {pinned && !approximate ? (
            <CheckCircle2 className="size-5" aria-hidden />
          ) : (
            <TriangleAlert className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {!pinned ? t("noPoint") : approximate ? t("approximatePoint") : t("exactPoint")}
          </p>
          <p className="text-muted-foreground mt-0.5">
            {!pinned
              ? town
                ? t("noPointTownHint", { town: town.name[locale] })
                : t("noPointHint")
              : approximate
                ? t("approximateHint")
                : t("exactHint")}
          </p>
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
            >
              <MapPin className="size-3.5" aria-hidden />
              {t("checkOnMap")}
            </a>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={locate}
          disabled={locating}
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className="size-4" aria-hidden />
          )}
          {t("useMyLocation")}
        </Button>
      </div>

      <Button type="submit" disabled={isPending} className="rounded-full">
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("save")}
      </Button>
    </form>
  );
}
