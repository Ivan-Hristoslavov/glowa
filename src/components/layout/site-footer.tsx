import { getTranslations } from "next-intl/server";

import { GlowaLogo } from "@/components/brand/glowa-logo";

export async function SiteFooter() {
  const t = await getTranslations("brand");

  return (
    <footer className="border-border/70 mt-24 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <GlowaLogo showTagline tagline={t("tagline")} markClassName="size-7" />
        <p className="text-xs tracking-wide">{t("madeIn")}</p>
      </div>
    </footer>
  );
}
