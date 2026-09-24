import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { CookieSettingsButton } from "@/components/legal/cookie-consent";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { listCities } from "@/lib/queries/discovery";

const LINK_CLASS =
  "text-muted-foreground hover:text-foreground glowa-focus group inline-flex items-center gap-1 rounded text-left text-sm transition-colors";

/**
 * Reads no cookies, so it cannot know whether the visitor is signed in. The
 * links are the ones that make sense either way: signed-in paths redirect to
 * sign-in and back.
 *
 * Four columns a visitor can scan in one look - clients, businesses, cities,
 * legal - under a single call to salons, and a bottom bar with the language,
 * the theme and the cookie settings the law requires to be reachable from
 * every page.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const brand = await getTranslations("brand");
  const legal = await getTranslations("legal");
  const locale = await getLocale();
  const ownerHref = `/signup?next=${encodeURIComponent(`/${locale}/onboarding`)}`;
  // The year for the copyright line; this is rendered at build or revalidate
  // time, never during a client render.
  const year = new Date().getFullYear();

  // A footer must never take a page down with it.
  const cities = await listCities()
    .then((all) => all.slice(0, 6))
    .catch(() => [] as string[]);

  const columns = [
    {
      title: t("customers"),
      links: [
        { href: "/search", label: t("findSalon") },
        { href: "/bookings", label: t("myBookings") },
        { href: "/favorites", label: t("favorites") },
        { href: "/login", label: t("login") },
      ],
    },
    {
      title: t("business"),
      links: [
        { href: ownerHref, label: t("register") },
        { href: "/pricing", label: t("pricing") },
        { href: "/dashboard", label: t("dashboard") },
      ],
    },
    ...(cities.length > 0
      ? [
          {
            title: t("cities"),
            links: cities.map((city) => ({
              href: `/search?city=${encodeURIComponent(city)}`,
              label: city,
            })),
          },
        ]
      : []),
    {
      title: t("legal"),
      links: [
        { href: "/legal/privacy", label: legal("privacy") },
        { href: "/legal/terms", label: legal("terms") },
        { href: "/legal/cookies", label: legal("cookies") },
        { href: "/legal/imprint", label: legal("imprint") },
      ],
      cookieSettings: true,
    },
  ];

  return (
    <footer className="border-border/70 bg-secondary/35 mt-24 border-t print:hidden">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* One call, for the audience that pays. */}
        <div className="border-border/70 relative -mt-px flex flex-col gap-5 overflow-hidden border-b py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="font-heading text-2xl leading-tight text-balance sm:text-[1.7rem]">
              {t("ctaTitle")}
            </p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t("ctaBody")}</p>
          </div>
          <Button asChild size="lg" className="group h-11 shrink-0 rounded-full px-6">
            <Link href={ownerHref}>
              {t("ctaButton")}
              <ArrowRight
                className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </Button>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.35fr_repeat(4,1fr)] lg:gap-8">
          <div className="space-y-5 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="glowa-focus inline-block rounded-md" aria-label="glowa">
              <GlowaLogo showTagline tagline={brand("tagline")} markClassName="size-8" />
            </Link>
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {t("about")}
            </p>
            <a
              href={`mailto:${LEGAL_ENTITY.email}`}
              className="text-foreground hover:text-primary glowa-focus inline-flex items-center gap-2 rounded text-sm font-medium transition-colors"
            >
              <Mail className="size-4" aria-hidden />
              {LEGAL_ENTITY.email}
            </a>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK_CLASS}>
                      {link.label}
                      <ArrowUpRight
                        className="size-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-60"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
                {"cookieSettings" in column ? (
                  <li>
                    <CookieSettingsButton className={LINK_CLASS} />
                  </li>
                ) : null}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-border/70 flex flex-col gap-4 border-t py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {t("rights", { year })} · {brand("madeIn")}
          </p>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
