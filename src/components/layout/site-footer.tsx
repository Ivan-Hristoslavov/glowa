import { getLocale, getTranslations } from "next-intl/server";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { Link } from "@/i18n/navigation";

/**
 * Reads no cookies, so it cannot know whether the visitor is signed in. The
 * links are the ones that make sense either way: signed-in paths redirect to
 * sign-in and back.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const brand = await getTranslations("brand");
  const locale = await getLocale();
  const ownerHref = `/signup?next=${encodeURIComponent(`/${locale}/onboarding`)}`;
  // The year for the copyright line; this is rendered at build or revalidate
  // time, never during a client render.
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t("customers"),
      links: [
        { href: "/search", label: t("findSalon") },
        { href: "/bookings", label: t("myBookings") },
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
  ];

  return (
    <footer className="border-border/70 mt-24 border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <GlowaLogo showTagline tagline={brand("tagline")} markClassName="size-8" />
          <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
            {brand("madeIn")}
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold">{column.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary glowa-focus rounded text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h2 className="text-sm font-semibold">{t("company")}</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <a
                href="mailto:hello@glowa.bg"
                className="text-muted-foreground hover:text-primary glowa-focus rounded text-sm transition-colors"
              >
                {t("contact")}
              </a>
            </li>
            <li className="text-muted-foreground text-sm">{t("languages")}</li>
          </ul>
        </div>
      </div>
      <div className="border-border/70 border-t">
        <p className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-6 text-xs sm:px-6">
          {t("rights", { year })}
        </p>
      </div>
    </footer>
  );
}
