"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Click-to-load map.
 *
 * An embedded map is an iframe to a third party, and loading it on page view
 * hands every visitor's IP address to that third party before they asked for
 * a map. So this renders a placeholder and only loads the frame when someone
 * actually wants it - the same reason the QR counters record nothing about
 * who scanned.
 *
 * OpenStreetMap rather than Google Maps: no API key, no billing, and it does
 * not require the visitor to be logged into anything.
 */
export function LocationMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  const t = useTranslations("business");
  const [loaded, setLoaded] = useState(false);

  // A small box around the point, which is what the embed API wants.
  const delta = 0.004;
  const bbox = [
    longitude - delta,
    latitude - delta / 2,
    longitude + delta,
    latitude + delta / 2,
  ].join("%2C");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  if (loaded) {
    return (
      <iframe
        src={src}
        title={label}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="border-border/70 mt-3 h-48 w-full rounded-lg border"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="border-border/70 bg-secondary/60 hover:bg-secondary glowa-focus mt-3 flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors"
    >
      <MapPin className="text-muted-foreground size-6" aria-hidden />
      <span className="text-sm font-medium">{t("showMap")}</span>
      <span className="text-muted-foreground max-w-56 text-center text-xs">
        {t("showMapNote")}
      </span>
    </button>
  );
}
