import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GlowaLogo } from "@/components/brand/glowa-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { isPlatformAdmin } from "@/lib/platform/overview";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The console for whoever runs the platform. Anyone else - signed in or not -
 * gets the same 404 as a page that does not exist, so its existence is not
 * advertised. The data call checks again on its own.
 */
export default async function PlatformLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await isPlatformAdmin())) notFound();

  const t = await getTranslations("platform");

  return (
    <div className="bg-sidebar min-h-dvh">
      <header className="bg-sidebar/85 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="glowa-focus rounded-md" aria-label="Lavena">
              <GlowaLogo markClassName="size-7" />
            </Link>
            <Badge variant="outline" className="hidden font-normal sm:inline-flex">
              {t("title")}
            </Badge>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/dashboard"
              className="glowa-focus text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("back")}
            </Link>
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
