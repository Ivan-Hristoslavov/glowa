import { MapPin, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { Rating } from "@/components/common/rating";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import type { SearchResult } from "@/lib/queries/discovery";

type BusinessCardProps = {
  business: SearchResult;
  locale: Locale;
};

export async function BusinessCard({ business, locale }: BusinessCardProps) {
  const t = await getTranslations("search");
  const categories = await getTranslations("categories");

  const price = formatPrice(business.min_price_cents, business.currency, locale);
  const pitch = pickLocalized(business.short_pitch, locale);
  const isDemo = business.slug.startsWith("demo-");

  return (
    <Link
      href={`/business/${business.slug}`}
      className="glowa-focus group glowa-card hover:shadow-lift focus-visible:ring-ring/60 flex flex-col overflow-hidden transition-shadow duration-300 focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="bg-secondary relative aspect-[16/10] overflow-hidden">
        {business.cover_image_url ? (
          <Image
            src={business.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // Photography is generated in a later pass; until then a branded
          // placeholder beats a grey box or a stock image.
          <div className="from-brand-soft/70 via-secondary to-brand-sage/40 flex h-full items-center justify-center bg-gradient-to-br">
            <Sparkles className="text-primary/70 size-7" aria-hidden />
          </div>
        )}
        {isDemo ? (
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 backdrop-blur-sm"
          >
            {t("demoBadge")}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-base leading-snug">{business.name}</h3>
          {price ? (
            <span className="text-muted-foreground shrink-0 text-xs">
              {t("priceFrom", { price })}
            </span>
          ) : null}
        </div>

        {pitch ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{pitch}</p>
        ) : null}

        <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
          <Badge variant="outline" className="font-normal">
            {categories(business.category)}
          </Badge>
          {business.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {business.city}
            </span>
          ) : null}
          {business.review_count > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Rating value={Number(business.average_rating)} />
              <span className="text-foreground font-medium">
                {Number(business.average_rating).toFixed(1)}
              </span>
              <span>({business.review_count})</span>
            </span>
          ) : (
            <span>{t("noReviews")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
