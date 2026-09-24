import {
  CalendarCheck2,
  CalendarOff,
  Clock,
  ExternalLink,
  Globe,
  Info,
  MapPin,
  MessageSquareQuote,
  Navigation,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Undo2,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";

import { OpenStatus } from "@/components/business/open-status";
import { PhotoGallery } from "@/components/business/photo-gallery";
import { EmptyState } from "@/components/common/empty-state";
import { JsonLd } from "@/components/common/json-ld";
import { Rating } from "@/components/common/rating";
import { LocationMap } from "@/components/discovery/location-map";
import { SaveBusinessButton } from "@/components/discovery/save-business-button";
import { Reveal } from "@/components/motion/reveal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, routing, type Locale } from "@/i18n/routing";
import { brandAssets, fallbackBusinessImage } from "@/lib/brand-assets";
import { effectiveDepositCents } from "@/lib/deposits";
import { formatDuration, formatPrice } from "@/lib/format";
import { salonCoverTransition } from "@/lib/transitions";
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

  const [t, categories] = await Promise.all([
    getTranslations({ locale, namespace: "business" }),
    getTranslations({ locale, namespace: "categories" }),
  ]);
  const city = business.locations[0]?.city ?? null;
  const category = categories(business.category);
  const pitch = pickLocalized(business.short_pitch, locale as Locale);

  // What people search is "<trade> in <town>", not a salon's name they do not
  // know yet - so both go in the title. The description leads with the salon's
  // own words and ends with what the page lets you do.
  const title = city
    ? t("metaTitleCity", { name: business.name, category, city })
    : t("metaTitle", { name: business.name, category });
  const tail = city
    ? t("metaDescriptionCity", { name: business.name, city })
    : t("metaDescription", { name: business.name });
  const full = [pitch, tail].filter(Boolean).join(" ");
  // Search engines cut near 160 characters; cut on a word rather than mid-word.
  const description =
    full.length <= 160 ? full : `${full.slice(0, 157).replace(/\s+\S*$/, "")}…`;

  // A salon link gets pasted into Viber, WhatsApp and Messenger far more often
  // than it gets typed, so it always needs a preview image. The salon's own
  // cover first, the category illustration when it has none, and the shared
  // social card as the last resort - never nothing.
  const image =
    business.cover_image_url ??
    fallbackBusinessImage(business.category, business.slug) ??
    brandAssets.ogImage;

  return {
    title,
    description,
    alternates: alternatesFor(`/${locale}/business/${slug}`),
    openGraph: {
      type: "website",
      title,
      description,
      url: `/${locale}/business/${slug}`,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
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
  const booking = await getTranslations("booking");
  const categories = await getTranslations("categories");
  const serviceCategories = await getTranslations("serviceCategories");
  const weekdays = await getTranslations("weekdays");

  const activeLocale = locale as Locale;
  const policy = readPolicy(business.booking_policy);
  const windowHours = policy.cancellation_window_hours ?? 24;
  const primaryLocation = business.locations[0] ?? null;
  const isDemo = business.slug.startsWith("demo-");

  // Days and hours the salon has closed (owner-entered, timezone-safe); shown
  // before anyone tries to book into them.
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
  const description = pickLocalized(business.description, activeLocale);
  const pitch = pickLocalized(business.short_pitch, activeLocale);
  const staffById = new Map(business.staff_profiles.map((s) => [s.id, s]));
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((day) => weekdays(String(day)));

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
  const photos = [heroImage, ...gallery].filter((src): src is string => Boolean(src));

  const mapsUrl = primaryLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [primaryLocation.address_line1, primaryLocation.city, primaryLocation.country_code]
          .filter(Boolean)
          .join(", "),
      )}`
    : null;

  const services = business.services.map((service) => ({
    ...service,
    depositCents: effectiveDepositCents(
      {
        requiresDeposit: service.requires_deposit,
        depositCents: service.deposit_cents,
        priceCents: service.price_cents,
      },
      business.deposits_enabled,
    ),
  }));
  const hasDeposits = services.some((service) => service.depositCents > 0);
  const pricedServices = services.filter((service) => service.price_cents > 0);
  const fromPrice = pricedServices.length
    ? formatPrice(
        Math.min(...pricedServices.map((service) => service.price_cents)),
        pricedServices[0].currency,
        activeLocale,
      )
    : null;

  // Services grouped by category, in the order the salon sorted them.
  const serviceGroups = new Map<string, typeof services>();
  for (const service of services) {
    const group = serviceGroups.get(service.category) ?? [];
    group.push(service);
    serviceGroups.set(service.category, group);
  }

  const openingHours = (primaryLocation?.business_hours ?? []).map((range) => ({
    day: range.day_of_week,
    opens: range.opens_at,
    closes: range.closes_at,
  }));

  const reviewCount = business.rating.review_count;
  const average = Number(business.rating.average_rating ?? 0);

  const sections = [
    { id: "services", label: t("services") },
    { id: "team", label: t("team") },
    { id: "reviews", label: t("reviews") },
    { id: "about", label: t("about") },
    { id: "location", label: t("location") },
  ];

  return (
    <main className="pb-28 lg:pb-20">
      <JsonLd data={businessJsonLd(business, activeLocale)} />
      <JsonLd
        data={breadcrumbJsonLd(activeLocale, [
          { name: t("breadcrumbHome"), path: "" },
          { name: t("breadcrumbSearch"), path: "/search" },
          { name: business.name, path: `/business/${business.slug}` },
        ])}
      />

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        {photos.length > 0 ? (
          <PhotoGallery
            images={photos}
            name={business.name}
            transitionName={salonCoverTransition(business.slug)}
          />
        ) : (
          <div className="from-brand-soft/70 via-secondary to-brand-sage/40 h-56 rounded-3xl bg-gradient-to-br sm:h-80" />
        )}

        {/* Identity */}
        <div className="mt-6 flex flex-col gap-5 sm:mt-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar className="border-background size-16 shrink-0 rounded-2xl border-2 shadow-[var(--shadow-card)] sm:size-20">
              {business.logo_url ? <AvatarImage src={business.logo_url} alt="" /> : null}
              <AvatarFallback className="from-primary to-brand-soft text-primary-foreground rounded-2xl bg-gradient-to-br">
                <span className="font-heading text-2xl sm:text-3xl">{business.name.charAt(0)}</span>
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {categories(business.category)}
                </Badge>
                <OpenStatus hours={openingHours} timezone={business.timezone} weekdays={weekdayNames} />
              </div>
              <h1 className="font-heading text-3xl leading-tight sm:text-5xl">{business.name}</h1>
              {pitch ? (
                <p className="text-muted-foreground max-w-2xl text-base sm:text-lg">{pitch}</p>
              ) : null}
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm">
                {reviewCount > 0 ? (
                  <a href="#reviews" className="hover:text-foreground inline-flex items-center gap-2">
                    <Rating value={average} size="md" label={average.toFixed(1)} />
                    <span className="text-foreground font-semibold">{average.toFixed(1)}</span>
                    <span className="underline-offset-4 hover:underline">
                      {t("reviewsCount", { count: reviewCount })}
                    </span>
                  </a>
                ) : null}
                {primaryLocation?.city ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden />
                    {[primaryLocation.address_line1, primaryLocation.city].filter(Boolean).join(", ")}
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
            </div>
          </div>
          <SaveBusinessButton businessId={business.id} className="shrink-0 self-start lg:self-end" />
        </div>

        {closures.length > 0 ? (
          <div className="border-destructive/25 bg-destructive/5 mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm">
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
          <p className="border-border/70 bg-secondary/50 text-muted-foreground mt-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("demoNotice")}
          </p>
        ) : null}
      </div>

      {/* Section tabs. Stuck, they reach up under the floating header so
          the page does not scroll by in the gap around it. */}
      <nav
        aria-label={t("sectionsLabel")}
        className="bg-background/85 sticky top-0 z-20 -mt-8 border-b pt-16 backdrop-blur-xl"
      >
        <ul className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-muted-foreground hover:text-foreground hover:border-primary/60 glowa-focus inline-block border-b-2 border-transparent px-3 py-3.5 text-sm font-medium whitespace-nowrap transition-colors"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-16">
          {/* Services */}
          <section id="services" className="scroll-mt-32 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-heading text-2xl sm:text-3xl">{t("services")}</h2>
              <span className="text-muted-foreground text-sm">
                {t("serviceCount", { count: services.length })}
              </span>
            </div>

            {services.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noServices")}</p>
            ) : (
              <div className="space-y-8">
                {[...serviceGroups.entries()].map(([category, group]) => (
                  <div key={category} className="space-y-3">
                    {serviceGroups.size > 1 ? (
                      <h3 className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                        {serviceCategories(category)}
                      </h3>
                    ) : null}
                    <ul className="glowa-card divide-y overflow-hidden rounded-2xl">
                      {group.map((service) => {
                        const price = formatPrice(service.price_cents, service.currency, activeLocale);
                        const serviceDescription = pickLocalized(service.description, activeLocale);
                        return (
                          <li key={service.id}>
                            <Link
                              href={`/business/${slug}/book?service=${service.id}`}
                              className="group hover:bg-muted/40 glowa-focus flex items-center gap-4 px-5 py-4 transition-colors"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-medium">{pickLocalized(service.name, activeLocale)}</p>
                                {serviceDescription ? (
                                  <p className="text-muted-foreground line-clamp-2 text-sm">
                                    {serviceDescription}
                                  </p>
                                ) : null}
                                <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="size-3.5" aria-hidden />
                                    {formatDuration(service.duration_minutes, activeLocale)}
                                  </span>
                                  {service.depositCents > 0 ? (
                                    <span className="text-primary inline-flex items-center gap-1">
                                      <ShieldCheck className="size-3.5" aria-hidden />
                                      {booking("depositChip", {
                                        amount:
                                          formatPrice(service.depositCents, service.currency, activeLocale) ??
                                          "",
                                      })}
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                {price ? (
                                  <span className="font-semibold tabular-nums">{price}</span>
                                ) : null}
                                <span className="border-border group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200">
                                  {t("book")}
                                </span>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Team */}
          <section id="team" className="scroll-mt-32 space-y-6">
            <h2 className="font-heading text-2xl sm:text-3xl">{t("team")}</h2>
            {business.staff_profiles.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noTeam")}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {business.staff_profiles.map((member, index) => {
                  const bio = pickLocalized(member.bio, activeLocale);
                  return (
                    <li key={member.id}>
                      <Reveal onView delay={Math.min(index, 5) * 0.05} className="h-full">
                        <Link
                          href={`/business/${slug}/book?staff=${member.id}`}
                          className="group glowa-focus flex h-full flex-col gap-3 rounded-2xl"
                        >
                          <div
                            className="relative aspect-[4/5] overflow-hidden rounded-2xl"
                            style={{ backgroundColor: `${member.color}22` }}
                          >
                            {member.avatar_url ? (
                              <Image
                                src={member.avatar_url}
                                alt={member.display_name}
                                fill
                                sizes="(min-width: 640px) 220px, 45vw"
                                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                              />
                            ) : (
                              <span
                                className="font-heading absolute inset-0 flex items-center justify-center text-5xl"
                                style={{ color: member.color }}
                              >
                                {member.display_name.charAt(0)}
                              </span>
                            )}
                            <span className="bg-card/90 text-foreground absolute right-3 bottom-3 left-3 translate-y-2 rounded-full px-3 py-1.5 text-center text-xs font-medium opacity-0 shadow-[var(--shadow-card)] backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                              {t("bookWith", { name: member.display_name.split(" ")[0] })}
                            </span>
                          </div>
                          <div className="space-y-0.5 px-1">
                            <p className="font-medium">{member.display_name}</p>
                            <p className="text-muted-foreground text-sm">
                              {pickLocalized(member.title, activeLocale)}
                            </p>
                            {bio ? (
                              <p className="text-muted-foreground/90 line-clamp-2 pt-1 text-xs">{bio}</p>
                            ) : null}
                          </div>
                        </Link>
                      </Reveal>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Reviews */}
          <section id="reviews" className="scroll-mt-32 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-heading text-2xl sm:text-3xl">{t("reviews")}</h2>
              {reviewCount > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="font-heading text-4xl leading-none">{average.toFixed(1)}</span>
                  <div>
                    <Rating value={average} size="md" label={average.toFixed(1)} />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("reviewsCount", { count: reviewCount })}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {business.reviews.length === 0 ? (
              <EmptyState icon={Star} title={t("noReviews")} body={t("noReviewsBody")} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {business.reviews.map((review) => {
                  const stylist = review.staff_profile_id
                    ? staffById.get(review.staff_profile_id)
                    : null;
                  return (
                    <li key={review.id} className="glowa-card flex flex-col gap-3 rounded-2xl p-5">
                      <div className="flex items-center justify-between gap-3">
                        <Rating value={review.rating} size="md" label={`${review.rating}`} />
                        <time dateTime={review.created_at} className="text-muted-foreground text-xs">
                          {new Date(review.created_at).toLocaleDateString(locale, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </div>
                      {review.comment ? (
                        <p className="text-[0.95rem] leading-relaxed">{review.comment}</p>
                      ) : null}
                      {/* Only a review tied to a booking is called a visit. */}
                      {review.appointment_id || stylist ? (
                        <div className="text-muted-foreground mt-auto flex items-center gap-2 text-xs">
                          <CalendarCheck2 className="size-3.5" aria-hidden />
                          {review.appointment_id ? t("verifiedVisit") : null}
                          {review.appointment_id && stylist ? " · " : null}
                          {stylist ? stylist.display_name : null}
                        </div>
                      ) : null}
                      {review.business_response ? (
                        <div className="bg-muted/60 rounded-xl p-3">
                          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                            <MessageSquareQuote className="size-3.5" aria-hidden />
                            {t("salonReply", { name: business.name })}
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
              <div className="rounded-2xl border border-dashed p-4">
                <Button asChild variant="outline" size="sm">
                  <a href={business.google_review_url} target="_blank" rel="noopener noreferrer">
                    {t("googleReview")}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </Button>
                <p className="text-muted-foreground mt-2 text-xs">{t("googleReviewNote")}</p>
              </div>
            ) : null}
          </section>

          {/* About */}
          <section id="about" className="scroll-mt-32 space-y-4">
            <h2 className="font-heading text-2xl sm:text-3xl">{t("about")}</h2>
            {description ? (
              <p className="text-muted-foreground max-w-3xl text-base leading-relaxed whitespace-pre-line">
                {description}
              </p>
            ) : null}
            <ul className="grid gap-3 pt-2 sm:grid-cols-2">
              <li className="bg-muted/50 flex items-start gap-3 rounded-2xl p-4 text-sm">
                <Undo2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("cancellationPolicy", { hours: windowHours })}</span>
              </li>
              {hasDeposits ? (
                <li className="bg-muted/50 flex items-start gap-3 rounded-2xl p-4 text-sm">
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{t("depositPolicy", { hours: windowHours })}</span>
                </li>
              ) : null}
              <li className="bg-muted/50 flex items-start gap-3 rounded-2xl p-4 text-sm">
                <Clock className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("leadTime", { minutes: policy.min_lead_minutes ?? 60 })}</span>
              </li>
              <li className="bg-muted/50 flex items-start gap-3 rounded-2xl p-4 text-sm">
                <CalendarCheck2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {policy.allow_customer_reschedule === false
                    ? t("rescheduleBlocked")
                    : t("rescheduleAllowed")}
                </span>
              </li>
            </ul>
          </section>

          {/* Location */}
          <section id="location" className="scroll-mt-32 space-y-6">
            <h2 className="font-heading text-2xl sm:text-3xl">{t("location")}</h2>
            {primaryLocation ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <address className="space-y-0.5 text-sm not-italic">
                    <p className="font-medium">{primaryLocation.name}</p>
                    {primaryLocation.address_line1 ? (
                      <p className="text-muted-foreground">{primaryLocation.address_line1}</p>
                    ) : null}
                    <p className="text-muted-foreground">
                      {[primaryLocation.postal_code, primaryLocation.city].filter(Boolean).join(" ")}
                    </p>
                  </address>
                  {mapsUrl ? (
                    <Button asChild variant="outline" size="sm" className="rounded-full">
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                        <Navigation className="size-4" aria-hidden />
                        {t("directions")}
                      </a>
                    </Button>
                  ) : null}
                  {primaryLocation.latitude !== null && primaryLocation.longitude !== null ? (
                    <LocationMap
                      latitude={Number(primaryLocation.latitude)}
                      longitude={Number(primaryLocation.longitude)}
                      label={`${business.name} — ${t("location")}`}
                    />
                  ) : null}
                </div>

                {primaryLocation.business_hours.length > 0 ? (
                  <div className="glowa-card rounded-2xl p-5">
                    <h3 className="mb-3 text-sm font-medium">{t("hours")}</h3>
                    <dl className="space-y-2 text-sm">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                        const ranges = primaryLocation.business_hours
                          .filter((h) => h.day_of_week === day)
                          .sort((a, b) => a.opens_at.localeCompare(b.opens_at));
                        return (
                          <div key={day} className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">{weekdays(String(day))}</dt>
                            <dd className={ranges.length ? "font-medium tabular-nums" : "text-muted-foreground"}>
                              {ranges.length
                                ? ranges
                                    .map((h) => `${h.opens_at.slice(0, 5)}–${h.closes_at.slice(0, 5)}`)
                                    .join(", ")
                                : t("closed")}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    <p className="text-muted-foreground mt-4 text-xs">
                      {t("timezone", { zone: business.timezone })}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        {/* Booking card */}
        <aside className="hidden lg:block">
          <div className="glowa-card sticky top-36 space-y-5 rounded-3xl p-6 shadow-[var(--shadow-lift)]">
            <div>
              {fromPrice ? (
                <p className="text-muted-foreground text-sm">
                  {t("priceFrom")}{" "}
                  <span className="font-heading text-foreground text-3xl">{fromPrice}</span>
                </p>
              ) : null}
              <OpenStatus
                hours={openingHours}
                timezone={business.timezone}
                weekdays={weekdayNames}
                className="mt-2"
              />
            </div>
            <Button asChild size="lg" className="h-12 w-full rounded-full text-base">
              <Link href={`/business/${slug}/book`}>{t("bookNow")}</Link>
            </Button>
            <ul className="text-muted-foreground space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                {t("perkInstant")}
              </li>
              <li className="flex items-start gap-2.5">
                <Undo2 className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                {t("cancellationPolicy", { hours: windowHours })}
              </li>
              {hasDeposits ? (
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  {t("perkDeposit")}
                </li>
              ) : null}
            </ul>
            {business.phone ? (
              <a
                href={`tel:${business.phone}`}
                className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 border-t pt-4 text-sm transition-colors"
              >
                <Phone className="size-4" aria-hidden />
                {t("callBusiness")} · {business.phone}
              </a>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Phone: the one action is always under the thumb. */}
      <div className="bg-background/90 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{business.name}</p>
            {fromPrice ? (
              <p className="text-muted-foreground text-xs">
                {t("priceFrom")} {fromPrice}
              </p>
            ) : null}
          </div>
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href={`/business/${slug}/book`}>{t("bookNow")}</Link>
          </Button>
        </div>
      </div>

    </main>
  );
}
