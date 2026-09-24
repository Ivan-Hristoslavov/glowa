import { MapPin, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ViewTransition } from "react";

import { Rating } from "@/components/common/rating";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fallbackBusinessImage } from "@/lib/brand-assets";
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

  // A business's own cover wins; otherwise generated art for its category, and
  // only then the brand gradient. Never a stock photo of the wrong trade.
  const image =
    business.cover_image_url ?? fallbackBusinessImage(business.category, business.slug);

  return (
    <Link
      href={`/business/${business.slug}`}
      className="glowa-focus group glowa-card glowa-lift focus-visible:ring-ring/60 flex h-full flex-col overflow-hidden rounded-3xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="bg-secondary relative aspect-[16/10] overflow-hidden">
        {image ? (
          // The same name sits on the salon page's hero, so the photograph
          // travels from this card into the page instead of the page swapping
          // out from under it.
          <ViewTransition name={`cover-${business.slug}`} share="glowa-morph" default="none">
            <div className="absolute inset-0">
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-[900ms] ease-[var(--ease-glowa)] group-hover:scale-[1.06]"
              />
            </div>
          </ViewTransition>
        ) : (
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

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading group-hover:text-primary text-lg leading-snug transition-colors">
            {business.name}
          </h3>
          {price ? (
            <span className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums">
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
