import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Wix_Madefor_Display, Wix_Madefor_Text } from "next/font/google";
import { notFound } from "next/navigation";

import { GlowPointer } from "@/components/motion/glow-pointer";
import { MotionProvider } from "@/components/motion/motion-provider";
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
// Wix Madefor, as a pair: Display for headings and Text for everything else,
// one design drawn at two optical sizes. Chosen by rendering real Bulgarian
// screens (the calendar, a salon card, the pitch) in twelve Cyrillic families
// against the reference the brand asked for - Fresha's Roobert, which is not
// licensable here. Madefor was the closest in feel (geometric but warm, round
// terminals) and, like Roobert, ships Bulgarian localised forms: with
// `lang="bg"` the browser switches в, д, л, ж to the Bulgarian shapes, which
// is what makes Bulgarian copy read native instead of Russian. The Text cut
// is spaced and weighted for 13-15px, where the calendar and forms live.
const madeforText = Wix_Madefor_Text({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

const madeforDisplay = Wix_Madefor_Display({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
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
      className={`${madeforText.variable} ${madeforDisplay.variable} h-full antialiased`}
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
        {/* No disableTransitionOnChange: ThemeToggle freezes transitions
            itself, everywhere except its own icon, so the icon can animate. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider>
            <MotionProvider>{children}</MotionProvider>
            <GlowPointer />
            <Toaster position="top-center" />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
