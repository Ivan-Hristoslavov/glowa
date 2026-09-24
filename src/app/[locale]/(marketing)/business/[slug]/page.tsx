import {
  CalendarOff,
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
import { ViewTransition } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { JsonLd } from "@/components/common/json-ld";
import { Rating } from "@/components/common/rating";
import { Section } from "@/components/common/section";
import { GalleryLightbox } from "@/components/discovery/gallery-lightbox";
import { LocationMap } from "@/components/discovery/location-map";
import { SaveBusinessButton } from "@/components/discovery/save-business-button";
import { StickyBookBar } from "@/components/discovery/sticky-book-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, routing, type Locale } from "@/i18n/routing";
import { brandAssets, fallbackBusinessImage } from "@/lib/brand-assets";
import { formatDuration, formatPrice } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import {
  getBusinessBySlug,
  listBusinessSlugs,
  listUpcomingClosures,
} from "@/lib/queries/discovery";
import {
  alternatesFor,
  breadcrumbJsonLd,
  businessJsonLd,
} from "@/lib/seo/structured-data";

type BookingPolicy = {
  min_lead_minutes?: number;
  max_advance_days?: number;
  cancellation_window_hours?: number;
  allow_customer_reschedule?: boolean;
};

function readPolicy(value: unknown): BookingPolicy {
  return typeof value === "object" && value !== null ? (value as BookingPolicy) : {};
}

/**
 * A salon page is the same for everyone and is the page that has to rank,
 * so it is cached rather than rendered per request. An hour is short enough
 * that a price or an opening hour change lands the same afternoon.
 */
export const revalidate = 3600;

/**
 * Prerenders the salons that exist at build time and leaves the rest to be
 * rendered on first request and then cached. Without this the segment has no
 * known params and Next renders it per request, which is the opposite of what
 * the page that has to rank needs.
 */
export async function generateStaticParams() {
  const businesses = await listBusinessSlugs();
  return routing.locales.flatMap((locale) =>
    businesses.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/business/[slug]">): Promise<Metadata> {
  const { slug, locale } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return {};

  const description = pickLocalized(business.short_pitch, locale as Locale);

  // A salon link gets pasted into Viber, WhatsApp and Messenger far more often
  // than it gets typed, so it always needs a preview image. The salon's own
  // cover first, the category illustration when it has none, and the shared
  // social card as the last resort - never nothing.
  const image =
    business.cover_image_url ??
    fallbackBusinessImage(business.category, business.slug) ??
    brandAssets.ogImage;

  return {
    title: business.name,
    description,
    alternates: alternatesFor(`/${locale}/business/${slug}`),
    openGraph: {
      type: "website",
      title: business.name,
      description,
      url: `/${locale}/business/${slug}`,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: business.name, description, images: [image] },
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

  const activeLocale = locale as Locale;
  const policy = readPolicy(business.booking_policy);
  const primaryLocation = business.locations[0] ?? null;
  const isDemo = business.slug.startsWith("demo-");
  const description = pickLocalized(business.description, activeLocale);
  const staffById = new Map(business.staff_profiles.map((s) => [s.id, s]));

  // `gallery` is jsonb, so it could hold anything. Only strings that look like
  // a URL are rendered, and at most twelve of them.
  const gallery = Array.isArray(business.gallery)
    ? business.gallery
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && /^(https?:)?\//.test(entry),
        )
        .slice(0, 12)
    : [];

  const heroImage =
    business.cover_image_url ?? fallbackBusinessImage(business.category, business.slug);

  const cheapest = business.services.reduce<(typeof business.services)[number] | null>(
    (lowest, service) =>
      !lowest || service.price_cents < lowest.price_cents ? service : lowest,
    null,
  );
  const fromPrice = cheapest
    ? formatPrice(cheapest.price_cents, cheapest.currency, activeLocale)
    : null;
  const search = await getTranslations("search");
  const closures = await listUpcomingClosures(business.id);
  const closureFormat = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: business.timezone,
  });
  const closureTime = new Intl.DateTimeFormat(localeHrefLang[activeLocale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: business.timezone,
  });
  // Midnight on the salon's clock marks a whole-day closure.
  const clock = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: business.timezone,
  });
  const atMidnight = (date: Date) => clock.format(date) === "00:00";
  /** "Fri 25 Dec – Sun 27 Dec", or "Fri 25 Dec, 12:00–18:00" for part of a day. */
  function describeClosure(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const startDay = closureFormat.format(start);
    if (atMidnight(start) && atMidnight(end)) {
      const lastDay = closureFormat.format(new Date(end.getTime() - 1));
      return startDay === lastDay ? startDay : `${startDay} – ${lastDay}`;
    }
    return startDay === closureFormat.format(end)
      ? `${startDay}, ${closureTime.format(start)}–${closureTime.format(end)}`
      : `${startDay} ${closureTime.format(start)} – ${closureFormat.format(end)} ${closureTime.format(end)}`;
  }

  const mapsUrl = primaryLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [primaryLocation.address_line1, primaryLocation.city, primaryLocation.country_code]
          .filter(Boolean)
          .join(", "),
      )}`
    : null;

  return (
    <main className="pb-16">
      <JsonLd data={businessJsonLd(business, activeLocale)} />
      <JsonLd
        data={breadcrumbJsonLd(activeLocale, [
          { name: t("breadcrumbHome"), path: "" },
          { name: t("breadcrumbSearch"), path: "/search" },
          { name: business.name, path: `/business/${business.slug}` },
        ])}
      />

      {/* Hero. The photograph shares a view-transition name with its search
          card, so it travels from the card into this frame. */}
      <div className="bg-secondary relative h-52 w-full overflow-hidden sm:h-80">
        {heroImage ? (
          <ViewTransition name={`cover-${business.slug}`} share="glowa-morph" default="none">
            <div className="absolute inset-0">
              <Image
                src={heroImage}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          </ViewTransition>
        ) : (
          <div className="from-brand-soft/70 via-secondary to-brand-sage/40 h-full bg-gradient-to-br" />
        )}
        <div
          aria-hidden
          className="from-background via-background/10 absolute inset-0 bg-gradient-to-t to-transparent"
        />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* Only the logo overlaps the photograph. The category badge used to
            sit above the name inside the overlapping row, and the photo's
            edge cut it in half. */}
        <div className="glowa-enter relative -mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar className="border-background size-24 border-4 shadow-[var(--shadow-lift)] sm:size-28">
              {business.logo_url ? <AvatarImage src={business.logo_url} alt="" /> : null}
              <AvatarFallback className="bg-card text-primary font-heading text-3xl">
                {business.name.charAt(0) || <Sparkles className="size-7" aria-hidden />}
              </AvatarFallback>
            </Avatar>
            <h1 className="font-heading pb-1 text-3xl leading-tight text-balance sm:text-4xl">
              {business.name}
            </h1>
          </div>

          {/* Booking is why anyone is on this page. On a phone it was 97px
              wide next to a 162px "save to favourites" - the secondary action
              outweighing the primary. Now it takes the row and saving shrinks
              to an icon. */}
          <div id="book-cta" className="flex items-center gap-2 pb-1">
            <Button asChild size="lg" className="shadow-primary/25 h-11 flex-1 px-6 shadow-lg sm:flex-none">
              <Link href={`/business/${slug}/book`}>{t("bookNow")}</Link>
            </Button>
            {/* Matches the booking button's height so the pair reads as one row. */}
            <SaveBusinessButton
              businessId={business.id}
              variant="icon"
              className="size-11 shrink-0"
            />
          </div>
        </div>

        <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Badge variant="secondary" className="font-medium">
            {categories(business.category)}
          </Badge>

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

        {closures.length > 0 ? (
          <div className="border-destructive/25 bg-destructive/5 mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm">
            <CalendarOff className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">{t("closedNotice")}</p>
              <ul className="text-muted-foreground mt-0.5 space-y-0.5">
                {closures.slice(0, 3).map((closure) => (
                  <li key={`${closure.starts_at}-${closure.location_id ?? "all"}`}>
                    {describeClosure(closure.starts_at, closure.ends_at)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

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

            {gallery.length > 0 ? (
              <Section title={t("gallery")}>
                <GalleryLightbox urls={gallery} businessName={business.name} />
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
                        className="hover:bg-card -mx-3 flex flex-col gap-3 rounded-2xl px-3 py-4 transition-colors duration-300 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
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
                        <Button
                          asChild
                          variant="outline"
                          className="hover:bg-primary hover:text-primary-foreground hover:border-primary shrink-0 rounded-full px-5"
                        >
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
                    <li key={member.id} className="glowa-card glowa-lift flex items-center gap-3 rounded-2xl p-4">
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

                {primaryLocation.latitude !== null &&
                primaryLocation.longitude !== null ? (
                  <LocationMap
                    latitude={Number(primaryLocation.latitude)}
                    longitude={Number(primaryLocation.longitude)}
                    label={`${business.name} — ${t("location")}`}
                  />
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

      <StickyBookBar
        watchId="book-cta"
        href={`/business/${slug}/book`}
        label={t("bookNow")}
        name={business.name}
        detail={
          [fromPrice ? search("priceFrom", { price: fromPrice }) : null, primaryLocation?.city]
            .filter(Boolean)
            .join(" · ") || null
        }
      />
    </main>
  );
}
