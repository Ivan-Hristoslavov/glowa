import { Star } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/empty-state";
import { Rating } from "@/components/common/rating";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localeHrefLang } from "@/i18n/routing";
import { pickLocalized } from "@/lib/localized";
import { listMyReviews } from "@/lib/queries/appointments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myReviews");
  return { title: t("title") };
}

export default async function MyReviewsPage({
  params,
}: PageProps<"/[locale]/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("myReviews");
  const review = await getTranslations("review");
  const reviews = await listMyReviews();
  const activeLocale = locale as Locale;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <ul className="space-y-3">
          {reviews.map((item) => (
            <li key={item.id} className="glowa-card space-y-2 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Rating value={item.rating} size="md" label={String(item.rating)} />
                  {item.businesses ? (
                    <Link
                      href={`/business/${item.businesses.slug}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.businesses.name}
                    </Link>
                  ) : null}
                </div>
                <Badge variant="outline" className="font-normal">
                  {t(`status.${item.status}`)}
                </Badge>
              </div>

              {item.appointments ? (
                <p className="text-muted-foreground text-xs">
                  {pickLocalized(item.appointments.service_name_snapshot, activeLocale)}
                  {" · "}
                  {new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
                    dateStyle: "medium",
                  }).format(new Date(item.appointments.starts_at))}
                </p>
              ) : null}

              {item.comment ? (
                <p className="text-sm leading-relaxed">{item.comment}</p>
              ) : null}

              {item.business_response ? (
                <div className="border-primary/40 mt-2 border-l-2 pl-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    {review("businessReplied")}
                  </p>
                  <p className="mt-1 text-sm">{item.business_response}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
