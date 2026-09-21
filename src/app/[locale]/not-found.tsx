import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function LocaleNotFound() {
  const t = await getTranslations("errors");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-primary text-sm font-medium tracking-[0.2em] uppercase">404</p>
      <h1 className="font-heading text-3xl">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundBody")}</p>
      <Button asChild className="mt-2">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </main>
  );
}
