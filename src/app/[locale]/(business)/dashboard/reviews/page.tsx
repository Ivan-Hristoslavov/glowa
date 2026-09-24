import { Star } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/admin/page-header";
import { GoogleReviewLink } from "@/components/admin/google-review-link";
import { ReviewResponse } from "@/components/admin/review-response";
import { EmptyState } from "@/components/common/empty-state";
import { Rating } from "@/components/common/rating";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { isLocalizedText, pickLocalized } from "@/lib/localized";
import {
  canAdminister,
  canManage,
  getActiveMembership,
  listBusinessReviews,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reviewsAdmin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const FILTERS = ["all", "unanswered", "hidden"] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminReviewsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/reviews">) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("admin.reviewsAdmin");
  const membership = await getActiveMembership();
  if (!membership) return null;

  const supabase = await createClient();
  const [reviews, { data: business }] = await Promise.all([
    listBusinessReviews(membership.businessId),
    supabase
      .from("businesses")
      .select("name, phone, email, website, google_review_url, description, booking_policy")
      .eq("id", membership.businessId)
      .maybeSingle(),
  ]);

  const activeLocale = locale as Locale;
  const dateFormatter = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    dateStyle: "medium",
  });
  const numberFormatter = new Intl.NumberFormat(localeHrefLang[activeLocale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const policy =
    typeof business?.booking_policy === "object" &&
    business.booking_policy !== null &&
    !Array.isArray(business.booking_policy)
      ? (business.booking_policy as Record<string, unknown>)
      : {};
  const description = isLocalizedText(business?.description) ? business.description : {};

  // Everything below is counted from the reviews on this page - no estimate,
  // no rounding up. The average is what clients see: published reviews only.
  const published = reviews.filter((review) => review.status === "published");
  const average =
    published.length > 0
      ? published.reduce((sum, review) => sum + review.rating, 0) / published.length
      : null;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: published.filter((review) => review.rating === stars).length,
  }));
  const unanswered = reviews.filter(
    (review) => review.status !== "hidden" && !review.business_response,
  );
  const hidden = reviews.filter((review) => review.status === "hidden");
  const answeredShare =
    reviews.length > 0
      ? Math.round(
          (reviews.filter((review) => review.business_response).length / reviews.length) * 100,
        )
      : 0;

  const filter = FILTERS.find((key) => key === firstParam(sp.filter)) ?? "all";
  const shown =
    filter === "unanswered" ? unanswered : filter === "hidden" ? hidden : reviews;
  const counts = { all: reviews.length, unanswered: unanswered.length, hidden: hidden.length };

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <>
          <section
            aria-label={t("summaryLabel")}
            className="glowa-card grid gap-6 rounded-2xl p-6 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-10"
          >
            <div className="flex items-center gap-4 md:block">
              <p className="font-heading text-5xl leading-none tabular-nums">
                {average === null ? "—" : numberFormatter.format(average)}
              </p>
              <div className="md:mt-3">
                <Rating value={average} size="md" />
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("reviewCount", { count: published.length })}
                </p>
              </div>
            </div>

            <ul className="space-y-1.5" aria-label={t("distributionLabel")}>
              {distribution.map((row) => (
                <li key={row.stars} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground flex w-8 items-center gap-1 tabular-nums">
                    {row.stars}
                    <Star className="fill-primary text-primary size-3" aria-hidden />
                  </span>
                  <span className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{
                        width: `${published.length ? (row.count / published.length) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span className="text-muted-foreground w-8 text-right tabular-nums">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="grid grid-cols-2 gap-3 md:w-56 md:grid-cols-1">
              <div className="bg-muted/60 rounded-xl px-4 py-3">
                <dt className="text-muted-foreground text-xs">{t("answeredShare")}</dt>
                <dd className="font-heading mt-0.5 text-xl tabular-nums">{answeredShare}%</dd>
              </div>
              <div
                className={cn(
                  "rounded-xl px-4 py-3",
                  unanswered.length > 0 ? "bg-warning/12" : "bg-muted/60",
                )}
              >
                <dt className="text-muted-foreground text-xs">{t("unanswered")}</dt>
                <dd
                  className={cn(
                    "font-heading mt-0.5 text-xl tabular-nums",
                    unanswered.length > 0 && "text-warning",
                  )}
                >
                  {unanswered.length}
                </dd>
              </div>
            </dl>
          </section>

          <div className="space-y-4">
            <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
              {FILTERS.map((key) => (
                <Link
                  key={key}
                  href={key === "all" ? "/dashboard/reviews" : `/dashboard/reviews?filter=${key}`}
                  aria-current={filter === key ? "page" : undefined}
                  className={cn(
                    "glowa-focus inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    filter === key
                      ? "border-foreground bg-foreground text-background"
                      : "bg-card hover:border-foreground/30",
                  )}
                >
                  {t(key)}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      filter === key ? "bg-background/20" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[key]}
                  </span>
                </Link>
              ))}
            </nav>

            {shown.length === 0 ? (
              <p className="text-muted-foreground glowa-card rounded-2xl p-6 text-center text-sm">
                {t("filterEmpty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {shown.map((review) => {
                  const name = review.appointments?.customer_name ?? null;
                  const service = pickLocalized(
                    review.appointments?.service_name_snapshot,
                    activeLocale,
                  );
                  return (
                    <li
                      key={review.id}
                      className={cn(
                        "glowa-card space-y-3 rounded-2xl p-5",
                        review.status === "hidden" && "opacity-70",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                          aria-hidden
                        >
                          {(name ?? "?").charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold">{name ?? t("anonymous")}</span>
                            {review.status === "hidden" ? (
                              <Badge variant="secondary">{t("hiddenBadge")}</Badge>
                            ) : null}
                            <time
                              className="text-muted-foreground ml-auto text-xs"
                              dateTime={review.created_at}
                            >
                              {dateFormatter.format(new Date(review.created_at))}
                            </time>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <Rating
                              value={review.rating}
                              label={t("ratingLabel", { rating: review.rating })}
                            />
                            {service ? (
                              <span className="text-muted-foreground truncate">{service}</span>
                            ) : null}
                            {review.staff_profiles ? (
                              <Badge variant="outline" className="font-normal">
                                {review.staff_profiles.display_name}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {review.comment ? (
                        <p className="text-[0.95rem] leading-relaxed">{review.comment}</p>
                      ) : (
                        <p className="text-muted-foreground text-sm italic">{t("noComment")}</p>
                      )}

                      {canManage(membership.role) ? (
                        <ReviewResponse
                          businessId={membership.businessId}
                          reviewId={review.id}
                          initialResponse={review.business_response ?? ""}
                          respondedLabel={
                            review.responded_at
                              ? dateFormatter.format(new Date(review.responded_at))
                              : null
                          }
                          status={review.status}
                        />
                      ) : review.business_response ? (
                        <p className="bg-muted/60 border-primary/50 rounded-r-xl border-l-2 px-4 py-3 text-sm">
                          {review.business_response}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <Section title={t("googleTitle")}>
        {canAdminister(membership.role) && business ? (
          <GoogleReviewLink
            businessId={membership.businessId}
            initialUrl={business.google_review_url ?? ""}
            rest={{
              name: business.name,
              phone: business.phone ?? "",
              email: business.email ?? "",
              website: business.website ?? "",
              description: {
                bg: description.bg ?? "",
                en: description.en ?? "",
                ro: description.ro ?? "",
              },
              cancellationWindowHours: Number(policy.cancellation_window_hours ?? 24),
              minLeadMinutes: Number(policy.min_lead_minutes ?? 60),
              maxAdvanceDays: Number(policy.max_advance_days ?? 90),
              allowCustomerReschedule: policy.allow_customer_reschedule !== false,
            }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{t("googleBody")}</p>
        )}
      </Section>

      <Section title={t("invitations")}>
        <p className="text-muted-foreground text-sm">{t("invitationsBody")}</p>
      </Section>
    </div>
  );
}
