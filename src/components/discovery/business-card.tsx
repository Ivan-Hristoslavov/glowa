import { MapPin, Sparkles, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ViewTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { fallbackBusinessImage } from "@/lib/brand-assets";
import { formatPrice } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import { formatDistance } from "@/lib/places";
import { salonCoverTransition } from "@/lib/transitions";
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
  const distance = formatDistance(business.distance_km, localeHrefLang[locale]);

  // A business's own cover wins; otherwise generated art for its category, and
  // only then the brand gradient. Never a stock photo of the wrong trade.
  const image =
    business.cover_image_url ?? fallbackBusinessImage(business.category, business.slug);

  return (
    <Link
      href={`/business/${business.slug}`}
      className="glowa-focus group flex flex-col gap-3 rounded-2xl focus-visible:outline-none"
    >
      {/* The same photo leads the salon page; named the same there, the card
          grows into the page's cover instead of being swapped for it. */}
      <ViewTransition name={salonCoverTransition(business.slug)} share="salon-cover" default="none">
      <div
        data-glow
        className="glowa-glow bg-secondary relative aspect-[4/3] overflow-hidden rounded-2xl"
      >
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="from-brand-soft/70 via-secondary to-brand-peach flex h-full items-center justify-center bg-gradient-to-br">
            <Sparkles className="text-primary/70 size-7" aria-hidden />
          </div>
        )}
        {business.review_count > 0 ? (
          <span className="bg-card/95 absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-[var(--shadow-card)] backdrop-blur">
            {Number(business.average_rating).toFixed(1)}
            <Star className="fill-foreground size-3" aria-hidden />
            <span className="text-muted-foreground font-normal">({business.review_count})</span>
          </span>
        ) : null}
        {isDemo ? (
          <Badge variant="secondary" className="absolute top-3 left-3 backdrop-blur-sm">
            {t("demoBadge")}
          </Badge>
        ) : null}
      </div>
      </ViewTransition>

      <div className="space-y-1 px-0.5">
        <h3 className="text-[1.05rem] leading-snug font-semibold tracking-[-0.01em]">
          {business.name}
        </h3>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
          {business.city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {business.city}
              {distance ? (
                <span className="text-foreground font-medium">· {distance}</span>
              ) : null}
            </span>
          ) : null}
          {business.city ? <span aria-hidden>·</span> : null}
          <span>{categories(business.category)}</span>
          {business.review_count === 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>{t("noReviews")}</span>
            </>
          ) : null}
        </p>
        {pitch ? <p className="text-muted-foreground line-clamp-1 text-sm">{pitch}</p> : null}
        {price ? (
          <p className="pt-0.5 text-sm font-medium">{t("priceFrom", { price })}</p>
        ) : null}
      </div>
    </Link>
  );
}
