import { setRequestLocale } from "next-intl/server";

import { FocusFooter } from "@/components/layout/focus-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Chrome for a task in progress - the booking funnel and salon onboarding.
 * Same header (the account and language have to stay reachable), but a slim
 * footer: no pitch to salon owners and no link farm under the confirm button.
 */
export default async function FocusLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <div id="main-content" className="flex-1">
        {children}
      </div>
      <FocusFooter />
    </>
  );
}
