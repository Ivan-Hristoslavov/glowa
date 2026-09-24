import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FlyerStudio, type FlyerLinkOption } from "@/components/admin/flyer-studio";
import type { Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { growthLinkUrl, renderQrSvg } from "@/lib/growth/qr";
import { canManage, getActiveMembership, listGrowthLinks } from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.flyer");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * A printable flyer with the salon's own logo, photo and words, and a QR
 * code that lands on the salon's page ready to book.
 *
 * The QR points at a growth link (`/go/<code>`) when the salon has one, so
 * scans are counted on the Growth page; the plain salon URL is offered too
 * for anyone who does not want the redirect.
 */
export default async function FlyerPage({ params }: PageProps<"/[locale]/dashboard/growth/flyer">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const membership = await getActiveMembership();
  if (!membership) return null;
  const activeLocale = locale as Locale;

  const supabase = await createClient();
  const [{ data: business }, { data: location }, links] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, slug, logo_url, cover_image_url, phone, category")
      .eq("id", membership.businessId)
      .maybeSingle(),
    supabase
      .from("locations")
      .select("address_line1, city")
      .eq("business_id", membership.businessId)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
    listGrowthLinks(membership.businessId),
  ]);
  if (!business) return null;

  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const directUrl = `${site}/${activeLocale}/business/${business.slug}`;

  const options: FlyerLinkOption[] = [
    ...(await Promise.all(
      links
        .filter((link) => link.is_active && link.kind !== "referral")
        .map(async (link) => {
          const url = growthLinkUrl(site, activeLocale, link.code);
          return {
            id: link.id,
            label: link.label,
            url,
            tracked: true,
            qrSvg: await renderQrSvg(url, { margin: 1 }),
          };
        }),
    )),
    {
      id: "direct",
      label: null,
      url: directUrl,
      tracked: false,
      qrSvg: await renderQrSvg(directUrl, { margin: 1 }),
    },
  ];

  return (
    <FlyerStudio
      businessId={membership.businessId}
      canCreateLink={canManage(membership.role)}
      business={{
        name: business.name,
        logoUrl: business.logo_url,
        coverUrl: business.cover_image_url,
        phone: business.phone,
        address: [location?.address_line1, location?.city].filter(Boolean).join(", ") || null,
      }}
      links={options}
    />
  );
}
