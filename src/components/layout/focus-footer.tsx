import { getTranslations } from "next-intl/server";

import { CookieSettingsButton } from "@/components/legal/cookie-consent";
import { Link } from "@/i18n/navigation";

/**
 * The footer for pages where someone is in the middle of a task: booking a
 * time, setting up a salon. The full footer sells to salon owners ("Have a
 * salon? Register it") and lists twenty links, which is the wrong thing to put
 * under a person who is one tap from confirming an appointment - or under a
 * salon owner who is, at that moment, registering one.
 *
 * What stays is what the law wants within reach: the legal pages and the
 * cookie choice.
 */
export async function FocusFooter() {
  const t = await getTranslations("footer");
  const legal = await getTranslations("legal");
  const brand = await getTranslations("brand");
  const year = new Date().getFullYear();

  const linkClass =
    "text-muted-foreground hover:text-foreground glowa-focus rounded transition-colors";

  return (
    <footer className="border-border/70 mt-16 border-t py-6 print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-muted-foreground">
          {t("rights", { year })} · {brand("madeIn")}
        </p>
        <nav aria-label={t("legal")}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/legal/privacy" className={linkClass}>
                {legal("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className={linkClass}>
                {legal("terms")}
              </Link>
            </li>
            <li>
              <CookieSettingsButton className={linkClass} />
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
