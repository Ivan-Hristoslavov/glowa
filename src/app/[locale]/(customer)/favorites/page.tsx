import { Heart, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { EmptyState } from "@/components/common/empty-state";
import { SaveBusinessButton } from "@/components/discovery/save-business-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pickLocalized } from "@/lib/localized";
import { listSavedBusinesses } from "@/lib/queries/appointments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("favorites");
  return { title: t("title") };
}

export default async function FavoritesPage({
  params,
}: PageProps<"/[locale]/favorites">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("favorites");
  const categories = await getTranslations("categories");
  const saved = await listSavedBusinesses();
  const activeLocale = locale as Locale;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>

      {saved.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("empty")}
          body={t("emptyBody")}
          action={
            <Button asChild>
              <Link href="/search">{t("discover")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {saved.map(({ businesses: item }) => {
            if (!item) return null;
            const city = item.locations?.find((l) => l.is_primary)?.city ?? null;
            return (
              <li key={item.id} className="glowa-card flex items-center gap-4 p-4">
                <div className="bg-secondary relative size-16 shrink-0 overflow-hidden rounded-lg">
                  {item.cover_image_url ? (
                    <Image
                      src={item.cover_image_url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="from-brand-soft/70 to-brand-sage/40 flex h-full items-center justify-center bg-gradient-to-br">
                      <Sparkles className="text-primary/70 size-5" aria-hidden />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/business/${item.slug}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-muted-foreground line-clamp-1 text-sm">
                    {pickLocalized(item.short_pitch, activeLocale)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {categories(item.category)}
                    </Badge>
                    {city ? (
                      <span className="text-muted-foreground text-xs">{city}</span>
                    ) : null}
                  </div>
                </div>

                <SaveBusinessButton
                  businessId={item.id}
                  initiallySaved
                  isSignedIn
                  variant="icon"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
