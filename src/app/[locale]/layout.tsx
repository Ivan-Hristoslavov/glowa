import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Onest, Playfair_Display } from "next/font/google";
import { notFound } from "next/navigation";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { localeHrefLang, routing } from "@/i18n/routing";
import { brandAssets } from "@/lib/brand-assets";
import { publicEnv } from "@/lib/env";
import { alternatesFor } from "@/lib/seo/structured-data";

import "../globals.css";

// Cyrillic and latin-ext coverage is a hard requirement: the same face has to
// carry Bulgarian, English and Romanian without falling back.
//
// Onest over Inter for the UI: it was drawn Cyrillic-first, so Bulgarian body
// copy reads warmer and less like a system font.
const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

// Playfair over Noto Serif Display for headings: its Cyrillic is properly
// drawn rather than a Latin face with Cyrillic bolted on, and the high stroke
// contrast is the editorial register the brand asks for. Weights are limited
// to what the design actually uses.
const playfairDisplay = Playfair_Display({
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
    manifest: "/manifest.webmanifest",
    // Installed on an iPhone this is how the app behaves: no browser chrome,
    // and a status bar that blends into the dark header.
    appleWebApp: {
      capable: true,
      title: "GLOWA",
      statusBarStyle: "black-translucent",
    },
    alternates: alternatesFor(`/${locale}`),
    openGraph: {
      type: "website",
      siteName: "glowa",
      locale: localeHrefLang[locale as keyof typeof localeHrefLang],
      title: `glowa — ${brand("tagline")}`,
      description: t("subtitle"),
      // Without this a shared link renders as a bare URL in every messenger.
      images: [
        {
          url: brandAssets.ogImage,
          width: 1200,
          height: 630,
          alt: `glowa — ${brand("tagline")}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `glowa — ${brand("tagline")}`,
      description: t("subtitle"),
      images: [brandAssets.ogImage],
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
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html
      lang={localeHrefLang[locale]}
      suppressHydrationWarning
      className={`${onest.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* First tab stop on every page. Without it a keyboard user walks the
            whole header - logo, nav, language, theme, account - before
            reaching the content, on every navigation. */}
        <a
          href="#main-content"
          className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:ring-2 focus:outline-none"
        >
          {t("skipToContent")}
        </a>
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
