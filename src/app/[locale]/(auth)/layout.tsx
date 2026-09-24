import { CalendarCheck2, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";
import { brandAssets } from "@/lib/brand-assets";

/**
 * Split screen on a wide display: the form on one side, a photograph and the
 * three reasons to bother on the other. On a phone only the form shows - a
 * picture above a login form is scrolling between someone and their password.
 */
export default async function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("auth");
  const points = [t("sidePoint1"), t("sidePoint2"), t("sidePoint3")];

  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex min-h-dvh flex-col">
        <div
          aria-hidden
          className="bg-brand-soft/40 pointer-events-none absolute -top-36 -right-24 size-80 rounded-full blur-3xl lg:hidden"
        />
        <header className="relative flex items-center justify-between px-4 py-5 sm:px-8">
          <Link href="/" className="glowa-focus rounded-md" aria-label="glowa">
            <GlowaLogo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main-content"
          className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6"
        >
          <div className="glowa-enter glowa-card w-full max-w-md rounded-3xl p-6 shadow-[var(--shadow-lift)] sm:p-8">
            {children}
          </div>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src={brandAssets.heroLight}
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover dark:hidden"
        />
        <Image
          src={brandAssets.heroDark}
          alt=""
          fill
          sizes="50vw"
          className="hidden object-cover dark:block"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5"
        />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
          <div
            className="glowa-enter glowa-float mb-8 inline-flex items-center gap-3 rounded-2xl bg-white/15 p-3 pr-5 backdrop-blur-md"
            style={{ "--delay": "300ms" } as React.CSSProperties}
          >
            <span className="bg-primary flex size-10 items-center justify-center rounded-xl">
              <CalendarCheck2 className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-medium">{points[0]}</span>
          </div>
          <p
            className="glowa-enter font-heading max-w-lg text-4xl leading-tight text-balance"
            style={{ "--delay": "150ms" } as React.CSSProperties}
          >
            {t("sideTitle")}
          </p>
          <p className="mt-4 max-w-md text-white/80">{t("sideBody")}</p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Check className="size-4" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
