import type { Route } from "next";
import Link from "next/link";

import messages from "../../messages/bg.json";
import { routing } from "@/i18n/routing";

import "./globals.css";

/**
 * Reached only for requests that never matched a locale (there is no root
 * layout, so this page renders its own document); every path under a locale
 * lands on `[locale]/not-found` through the `[...rest]` catch-all. It cannot
 * read the visitor's locale, so it speaks the default one.
 */
export default function GlobalNotFound() {
  const { errors, brand } = messages;
  return (
    <html lang={routing.defaultLocale} className="h-full antialiased" suppressHydrationWarning>
      <body className="bg-background text-foreground flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-primary text-sm font-medium tracking-[0.2em] uppercase">404</p>
        <h1 className="text-3xl font-semibold">{errors.notFoundTitle}</h1>
        <p className="text-muted-foreground">{errors.notFoundBody}</p>
        <Link
          href={`/${routing.defaultLocale}` as Route}
          className="text-primary underline underline-offset-4"
        >
          {errors.goHome} · {brand.name}
        </Link>
      </body>
    </html>
  );
}
