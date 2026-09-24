import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import {
  BookingFlow,
  type BookingService,
  type BookingStaff,
} from "@/components/booking/booking-flow";
import type { Locale } from "@/i18n/routing";
import { pickLocalized } from "@/lib/localized";
import { getBusinessBySlug } from "@/lib/queries/discovery";
import { createClient } from "@/lib/supabase/server";
import { getAuthProviders } from "@/lib/supabase/auth-providers";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/business/[slug]/book">): Promise<Metadata> {
  const { slug } = await params;
  const [business, t] = await Promise.all([
    getBusinessBySlug(slug),
    getTranslations("booking"),
  ]);
  return {
    title: business ? `${t("title")} · ${business.name}` : t("title"),
    // A booking funnel has no business in search results.
    robots: { index: false, follow: true },
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookPage({
  params,
  searchParams,
}: PageProps<"/[locale]/business/[slug]/book">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const t = await getTranslations("booking");
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const isSignedIn = typeof claimsData?.claims?.sub === "string";

  const activeLocale = locale as Locale;

  // Localized content is resolved on the server so the client component gets
  // plain strings and never has to carry the whole jsonb payload.
  const services: BookingService[] = business.services.map((service) => ({
    id: service.id,
    name: pickLocalized(service.name, activeLocale),
    description: pickLocalized(service.description, activeLocale),
    durationMinutes: service.duration_minutes,
    priceCents: service.price_cents,
    currency: service.currency,
    staffIds: (service.service_staff ?? []).map((row) => row.staff_profile_id),
  }));

  const staff: BookingStaff[] = business.staff_profiles
    .filter((member) => member.is_bookable)
    .map((member) => ({
      id: member.id,
      displayName: member.display_name,
      title: pickLocalized(member.title, activeLocale),
      avatarUrl: member.avatar_url,
      color: member.color,
    }));

  const policy =
    typeof business.booking_policy === "object" && business.booking_policy !== null
      ? (business.booking_policy as { cancellation_window_hours?: number })
      : {};

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 space-y-1">
        <p className="text-muted-foreground text-sm">{business.name}</p>
        <h1 className="font-heading text-3xl">{t("title")}</h1>
      </div>

      <BookingFlow
        businessId={business.id}
        slug={slug}
        businessName={business.name}
        timezone={business.timezone}
        locale={activeLocale}
        isSignedIn={isSignedIn}
        googleSignIn={isSignedIn ? false : (await getAuthProviders()).google}
        cancellationWindowHours={policy.cancellation_window_hours ?? 24}
        locations={business.locations.map((location) => ({
          id: location.id,
          name: location.name,
          city: location.city,
        }))}
        services={services}
        staff={staff}
        initialServiceId={firstParam(sp.service)}
      />
    </main>
  );
}
