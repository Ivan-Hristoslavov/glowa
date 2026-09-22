import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OnboardingForm } from "@/components/admin/onboarding-form";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.onboarding");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function OnboardingPage({
  params,
}: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.onboarding");

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <OnboardingForm defaultLocale={locale as Locale} />
      </div>

      <aside className="glowa-card h-fit p-5">
        <h2 className="font-heading mb-3 text-base">{t("whatHappens")}</h2>
        <ul className="text-muted-foreground space-y-3 text-sm">
          {[t("bullet1"), t("bullet2"), t("bullet3")].map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
