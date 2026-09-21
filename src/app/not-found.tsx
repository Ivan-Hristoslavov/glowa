import type { Route } from "next";
import Link from "next/link";

import { routing } from "@/i18n/routing";

import "./globals.css";

/**
 * Reached only for paths outside any locale (there is no root layout, so this
 * page renders its own document). Locale-aware 404s live in [locale]/not-found.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-background text-foreground flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">
          The link may be outdated or the page has moved.
        </p>
        <Link
          href={`/${routing.defaultLocale}` as Route}
          className="text-primary underline underline-offset-4"
        >
          Go to glowa
        </Link>
      </body>
    </html>
  );
}
