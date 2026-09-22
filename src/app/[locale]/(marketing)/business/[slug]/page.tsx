import {
  Clock,
  ExternalLink,
  Globe,
  Info,
  MapPin,
  Phone,
  Sparkles,
  Star,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/common/empty-state";
import { Rating } from "@/components/common/rating";
import { Section } from "@/components/common/section";
import { SaveBusinessButton } from "@/components/discovery/save-business-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fallbackBusinessImage } from "@/lib/brand-assets";
import { formatDuration, formatPrice } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import { getBusinessBySlug } from "@/lib/queries/discovery";
import { createClient } from "@/lib/supabase/server";

type BookingPolicy = {
  min_lead_minutes?: number;
  max_advance_days?: number;
  cancellation_window_hours?: number;
  allow_customer_reschedule?: boolean;
};

function readPolicy(value: unknown): BookingPolicy {
  return typeof value === "object" && value !== null ? (value as BookingPolicy) : {};
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/business/[slug]">): Promise<Metadata> {
  const { slug, locale } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return {};

  const description = pickLocalized(business.short_pitch, locale as Locale);
  return {
    title: business.name,
    description,
    alternates: { canonical: `/${locale}/business/${slug}` },
    openGraph: {
      title: business.name,
      description,
      images: business.cover_image_url ? [business.cover_image_url] : undefined,
    },
  };
}

export default async function BusinessPage({
  params,
}: PageProps<"/[locale]/business/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const t = await getTranslations("business");
  const categories = await getTranslations("categories");
  const serviceCategories = await getTranslations("serviceCategories");
  const weekdays = await getTranslations("weekdays");
  const common = await getTranslations("common");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const isSignedIn = typeof userId === "string";

  let isSaved = false;
  if (isSignedIn) {
    const { data: saved } = await supabase
      .from("saved_businesses")
      .select("business_id")
      .eq("business_id", business.id)
      .maybeSingle();
    isSaved = Boolean(saved);
  }

  const activeLocale = locale as Locale;
  const policy = readPolicy(business.booking_policy);
  const primaryLocation = business.locations[0] ?? null;
  const isDemo = business.slug.startsWith("demo-");
  const description = pickLocalized(business.description, activeLocale);
  const staffById = new Map(business.staff_profiles.map((s) => [s.id, s]));

  const heroImage =
    business.cover_image_url ?? fallbackBusinessImage(business.category, business.slug);

  const mapsUrl = primaryLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [primaryLocation.address_line1, primaryLocation.city, primaryLocation.country_code]
          .filter(Boolean)
          .join(", "),
      )}`
    : null;

  return (
    <main className="pb-16">
      {/* Hero */}
      <div className="bg-secondary relative h-44 w-full overflow-hidden sm:h-64">
        {heroImage ? (
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="from-brand-soft/70 via-secondary to-brand-sage/40 h-full bg-gradient-to-br" />
        )}
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar className="border-background size-24 border-4 shadow-md sm:size-28">
              {business.logo_url ? <AvatarImage src={business.logo_url} alt="" /> : null}
              <AvatarFallback className="bg-card text-primary">
                <Sparkles className="size-7" aria-hidden />
              </AvatarFallback>
            </Avatar>
            <div className="pb-1">
              <Badge variant="outline" className="mb-2 font-normal">
                {categories(business.category)}
              </Badge>
              <h1 className="font-heading text-2xl leading-tight sm:text-3xl">
                {business.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-1">
            <SaveBusinessButton
              businessId={business.id}
              initiallySaved={isSaved}
              isSignedIn={isSignedIn}
            />
            <Button asChild size="lg">
              <Link href={`/business/${slug}/book`}>
                {t("bookNow")}
              </Link>
            </Button>
          </div>
        </div>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {business.rating.review_count > 0 ? (
            <span className="inline-flex items-center gap-2">
              <Rating
                value={Number(business.rating.average_rating)}
                size="md"
                label={String(business.rating.average_rating)}
              />
              <span className="text-foreground font-medium">
                {Number(business.rating.average_rating).toFixed(1)}
              </span>
              <span>{t("reviewsCount", { count: business.rating.review_count })}</span>
            </span>
          ) : (
            <span>{t("reviewsCount", { count: 0 })}</span>
          )}

          {primaryLocation?.city ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {primaryLocation.city}
            </span>
          ) : null}

          {business.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              <Phone className="size-4" aria-hidden />
              {business.phone}
            </a>
          ) : null}

          {business.website ? (
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              <Globe className="size-4" aria-hidden />
              {t("website")}
            </a>
          ) : null}
        </div>

        {isDemo ? (
          <p className="border-border/70 bg-secondary/50 text-muted-foreground mt-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-xs">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("demoNotice")}
          </p>
        ) : null}

        <Separator className="my-8" />

        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-12">
            {description ? (
              <Section title={t("about")}>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {description}
                </p>
              </Section>
            ) : null}

            <Section id="services" title={t("services")}>
              {business.services.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noServices")}</p>
              ) : (
                <ul className="divide-border/70 divide-y">
                  {business.services.map((service) => {
                    const price = formatPrice(
                      service.price_cents,
                      service.currency,
                      activeLocale,
                    );
                    const serviceDescription = pickLocalized(
                      service.description,
                      activeLocale,
                    );
                    return (
                      <li
                        key={service.id}
                        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {pickLocalized(service.name, activeLocale)}
                            </p>
                            <Badge variant="outline" className="font-normal">
                              {serviceCategories(service.category)}
                            </Badge>
                          </div>
                          {serviceDescription ? (
                            <p className="text-muted-foreground text-sm">
                              {serviceDescription}
                            </p>
                          ) : null}
                          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                            <Clock className="size-3.5" aria-hidden />
                            {formatDuration(service.duration_minutes, activeLocale)}
                            {price ? <span aria-hidden>·</span> : null}
                            {price ? <span className="text-foreground">{price}</span> : null}
                          </p>
                        </div>
                        <Button asChild variant="outline" className="shrink-0">
                          <Link href={`/business/${slug}/book?service=${service.id}`}>
                            {t("book")}
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title={t("team")}>
              {business.staff_profiles.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noTeam")}</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {business.staff_profiles.map((member) => (
                    <li key={member.id} className="glowa-card flex items-center gap-3 p-4">
                      <Avatar className="size-11">
                        {member.avatar_url ? (
                          <AvatarImage src={member.avatar_url} alt="" />
                        ) : null}
                        <AvatarFallback
                          style={{ backgroundColor: `${member.color}22`, color: member.color }}
                          className="text-sm font-medium"
                        >
                          {member.display_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{member.display_name}</p>
                        <p className="text-muted-foreground truncate text-sm">
                          {pickLocalized(member.title, activeLocale)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={t("reviews")}>
              {business.reviews.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title={t("noReviews")}
                  body={t("noReviewsBody")}
                />
              ) : (
                <ul className="space-y-4">
                  {business.reviews.map((review) => {
                    const author = review.staff_profile_id
                      ? staffById.get(review.staff_profile_id)
                      : null;
                    return (
                      <li key={review.id} className="glowa-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Rating value={review.rating} size="md" label={`${review.rating}`} />
                          <time
                            dateTime={review.created_at}
                            className="text-muted-foreground text-xs"
                          >
                            {new Date(review.created_at).toLocaleDateString(locale)}
                          </time>
                        </div>
                        {review.comment ? (
                          <p className="mt-2 text-sm leading-relaxed">{review.comment}</p>
                        ) : null}
                        {author ? (
                          <p className="text-muted-foreground mt-2 text-xs">
                            {author.display_name}
                          </p>
                        ) : null}
                        {review.business_response ? (
                          <div className="border-primary/40 mt-3 border-l-2 pl-3">
                            <p className="text-muted-foreground text-xs font-medium">
                              {business.name}
                            </p>
                            <p className="mt-1 text-sm">{review.business_response}</p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}

              {business.google_review_url ? (
                <div className="border-border/70 mt-5 rounded-lg border border-dashed p-4">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={business.google_review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("googleReview")}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </Button>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {t("googleReviewNote")}
                  </p>
                </div>
              ) : null}
            </Section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {primaryLocation ? (
              <div className="glowa-card p-5">
                <h2 className="font-heading mb-3 text-base">{t("location")}</h2>
                <address className="text-muted-foreground space-y-0.5 text-sm not-italic">
                  <p className="text-foreground font-medium">{primaryLocation.name}</p>
                  {primaryLocation.address_line1 ? (
                    <p>{primaryLocation.address_line1}</p>
                  ) : null}
                  <p>
                    {[primaryLocation.postal_code, primaryLocation.city]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </address>
                {mapsUrl ? (
                  <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2">
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      <MapPin className="size-4" aria-hidden />
                      {common("view")}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </Button>
                ) : null}

                {primaryLocation.business_hours.length > 0 ? (
                  <>
                    <Separator className="my-4" />
                    <h3 className="mb-2 text-sm font-medium">{t("hours")}</h3>
                    <dl className="text-muted-foreground space-y-1 text-sm">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                        const ranges = primaryLocation.business_hours
                          .filter((h) => h.day_of_week === day)
                          .sort((a, b) => a.opens_at.localeCompare(b.opens_at));
                        return (
                          <div key={day} className="flex justify-between gap-4">
                            <dt>{weekdays(String(day))}</dt>
                            <dd className={ranges.length ? "text-foreground" : undefined}>
                              {ranges.length
                                ? ranges
                                    .map(
                                      (h) =>
                                        `${h.opens_at.slice(0, 5)}–${h.closes_at.slice(0, 5)}`,
                                    )
                                    .join(", ")
                                : t("closed")}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="glowa-card p-5">
              <h2 className="font-heading mb-3 text-base">{t("policies")}</h2>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  {t("cancellationPolicy", {
                    hours: policy.cancellation_window_hours ?? 24,
                  })}
                </li>
                <li>{t("leadTime", { minutes: policy.min_lead_minutes ?? 60 })}</li>
                <li>{t("advanceWindow", { days: policy.max_advance_days ?? 90 })}</li>
                <li>
                  {policy.allow_customer_reschedule === false
                    ? t("rescheduleBlocked")
                    : t("rescheduleAllowed")}
                </li>
                <li className="text-xs">{t("timezone", { zone: business.timezone })}</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
