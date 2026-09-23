import { setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default async function MarketingLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  // Without this the header and footer read the locale from the request, and
  // every page under this layout is rendered per request as a result.
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <div id="main-content" className="flex-1">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
