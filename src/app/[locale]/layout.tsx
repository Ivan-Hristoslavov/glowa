import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Inter, Noto_Serif_Display } from "next/font/google";
import { notFound } from "next/navigation";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { localeHrefLang, routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

import "../globals.css";

// Cyrillic and latin-ext coverage is a hard requirement: the same face has to
// carry Bulgarian, English and Romanian without falling back.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

const notoSerifDisplay = Noto_Serif_Display({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const brand = await getTranslations({ locale, namespace: "brand" });

  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: {
      default: `glowa — ${t("titleLine1")} ${t("titleLine2")}`,
      template: "%s · glowa",
    },
    description: t("subtitle"),
    applicationName: "glowa",
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        routing.locales.map((value) => [localeHrefLang[value], `/${value}`]),
      ),
    },
    openGraph: {
      type: "website",
      siteName: "glowa",
      locale: localeHrefLang[locale as keyof typeof localeHrefLang],
      title: `glowa — ${brand("tagline")}`,
      description: t("subtitle"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={localeHrefLang[locale]}
      suppressHydrationWarning
      className={`${inter.variable} ${notoSerifDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider>
            {children}
            <Toaster position="top-center" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
