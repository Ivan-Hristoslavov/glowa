import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function CustomerLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
