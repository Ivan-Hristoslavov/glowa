import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PLACES } from "@/lib/places";

const linkClass =
  "glowa-focus text-muted-foreground hover:text-foreground rounded-sm text-sm transition-colors";

/**
 * Where a page ends: every door out of it, in three short columns, and one
 * invitation for salon owners - the reader most likely to reach the bottom of
 * a page on purpose. Only pages that exist are linked.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const brand = await getTranslations("brand");
  const locale = (await getLocale()) as Locale;

  // The largest towns of the visitor's country, in the list's own order.
  const country = locale === "ro" ? "RO" : "BG";
  const cities = PLACES.filter((place) => place.country === country).slice(0, 6);

  const columns = [
    {
      title: t("forClients"),
      links: [
        { href: "/search", label: t("findSalon") },
        { href: "/bookings", label: nav("bookings") },
        { href: "/favorites", label: nav("favorites") },
        { href: "/reviews", label: nav("reviews") },
      ],
    },
    {
      title: t("forSalons"),
      links: [
        { href: "/for-business", label: t("whyGlowa") },
        { href: "/pricing", label: nav("pricing") },
        { href: "/signup", label: t("registerSalon") },
        { href: "/login", label: nav("login") },
      ],
    },
  ] as const;

  return (
    <footer className="bg-muted/35 relative mt-24 overflow-hidden border-t">
      {/* A low warm glow behind the top edge, the same light as the hero. */}
      <div
        aria-hidden
        className="bg-brand-peach/50 pointer-events-none absolute -top-40 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-14 pb-8 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr]">
          <div className="space-y-5">
            <GlowaLogo showTagline tagline={brand("tagline")} markClassName="size-8" />
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {t("about")}
            </p>
            <Link
              href="/for-business"
              data-glow
              className="glowa-focus glowa-glow group bg-card hover:border-primary/40 inline-flex max-w-sm items-center gap-4 rounded-2xl border p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t("ctaTitle")}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {t("ctaBody")}
                </span>
              </span>
              <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:rotate-45">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="text-sm font-semibold">{column.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav aria-label={t("cities")}>
              <p className="text-sm font-semibold">{t("cities")}</p>
              <ul className="mt-4 space-y-2.5">
                {cities.map((city) => (
                  <li key={city.id}>
                    <Link href={`/search?place=${city.id}`} className={linkClass}>
                      {city.name[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="text-muted-foreground mt-14 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} glowa · {brand("madeIn")}
          </p>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* The name, very large and very quiet, as the last thing on the page. */}
      <p
        aria-hidden
        className="font-heading text-foreground/[0.045] pointer-events-none -mt-6 h-[0.8em] overflow-hidden text-center text-[clamp(5rem,20vw,16rem)] leading-[0.9] tracking-tighter select-none"
      >
        glowa
      </p>
    </footer>
  );
}
