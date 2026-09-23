import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";

/**
 * Makes GLOWA installable.
 *
 * A salon runs its day on a phone, and the gap to a native app is mostly this
 * file plus push notifications - no app store, no review queue, one codebase.
 *
 * `start_url` carries the default locale because every route is prefixed; an
 * unprefixed start URL would bounce the installed app through a redirect on
 * every launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GLOWA — записвания и управление на салон",
    short_name: "GLOWA",
    description:
      "Онлайн записвания, календар за екипа и клиентска база за салони за красота.",
    start_url: `/${routing.defaultLocale}`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: routing.defaultLocale,
    dir: "ltr",
    // Matches the light canvas so the splash screen does not flash white.
    background_color: "#f8f3ee",
    theme_color: "#0f1212",
    categories: ["business", "lifestyle", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // The two things a salon opens from a home screen.
    shortcuts: [
      {
        name: "Календар",
        url: `/${routing.defaultLocale}/dashboard/calendar`,
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Открий салон",
        url: `/${routing.defaultLocale}/search`,
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
