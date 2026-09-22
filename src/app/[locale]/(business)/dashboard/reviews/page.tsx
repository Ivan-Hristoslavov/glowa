import { Star } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GoogleReviewLink } from "@/components/admin/google-review-link";
import { ReviewResponse } from "@/components/admin/review-response";
import { EmptyState } from "@/components/common/empty-state";
import { Rating } from "@/components/common/rating";
import { Section } from "@/components/common/section";
import { Badge } from "@/components/ui/badge";
import { localeHrefLang, type Locale } from "@/i18n/routing";
import { isLocalizedText } from "@/lib/localized";
import {
  canAdminister,
  canManage,
  getActiveMembership,
  listBusinessReviews,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reviewsAdmin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminReviewsPage({
  params,
}: PageProps<"/[locale]/dashboard/reviews">) {
  const { locale } = await params;
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

  const policy =
    typeof business?.booking_policy === "object" &&
    business.booking_policy !== null &&
    !Array.isArray(business.booking_policy)
      ? (business.booking_policy as Record<string, unknown>)
      : {};
  const description = isLocalizedText(business?.description) ? business.description : {};

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>

      {reviews.length === 0 ? (
        <EmptyState icon={Star} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="glowa-card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Rating value={review.rating} size="md" label={String(review.rating)} />
                  <span className="text-muted-foreground text-sm">
                    {review.appointments?.customer_name ?? "—"}
                  </span>
                  {review.staff_profiles ? (
                    <Badge variant="outline" className="font-normal">
                      {review.staff_profiles.display_name}
                    </Badge>
                  ) : null}
                  {review.status === "hidden" ? (
                    <Badge variant="secondary">{t("hidden")}</Badge>
                  ) : null}
                </div>
                <time className="text-muted-foreground text-xs" dateTime={review.created_at}>
                  {dateFormatter.format(new Date(review.created_at))}
                </time>
              </div>

              {review.comment ? (
                <p className="text-sm leading-relaxed">{review.comment}</p>
              ) : null}

              {canManage(membership.role) ? (
                <ReviewResponse
                  businessId={membership.businessId}
                  reviewId={review.id}
                  initialResponse={review.business_response ?? ""}
                  status={review.status}
                />
              ) : review.business_response ? (
                <p className="border-primary/40 border-l-2 pl-3 text-sm">
                  {review.business_response}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
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
