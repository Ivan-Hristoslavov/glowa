import { getTranslations, setRequestLocale } from "next-intl/server";

import { PlatformDashboard } from "@/components/platform/platform-dashboard";
import { getPlatformOverview } from "@/lib/platform/overview";

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("title") };
}

export default async function PlatformPage({ params }: PageProps<"/[locale]/platform">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform");
  const data = await getPlatformOverview(365);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>
      {data ? (
        <PlatformDashboard data={data} />
      ) : (
        <p className="glowa-card text-muted-foreground p-6 text-sm">{t("loadError")}</p>
      )}
    </div>
  );
}
