import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

const BASE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/**
 * Discovery is the point of the public side, so crawling is open - with two
 * exceptions.
 *
 * `/api` and the signed-in areas hold nothing a crawler should index, and a
 * `?next=` or `?error=` parameter on an auth page would otherwise fill the
 * index with near-duplicates of the login screen.
 *
 * A non-production deployment disallows everything: a preview URL that gets
 * indexed outranks the real site for its own content.
 */
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";

  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/*/login",
          "/*/signup",
          "/*/forgot-password",
          "/*/reset-password",
          "/*/dashboard",
          "/*/onboarding",
          "/*/profile",
          "/*/bookings",
          "/*/favorites",
          "/*/settings",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
