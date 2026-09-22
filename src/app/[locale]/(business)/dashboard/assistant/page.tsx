import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AssistantPanel } from "@/components/admin/assistant-panel";
import type { Locale } from "@/i18n/routing";
import { isAssistantConfigured } from "@/lib/ai";
import { getActiveMembership } from "@/lib/queries/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.assistant");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AssistantPage({
  params,
}: PageProps<"/[locale]/dashboard/assistant">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("admin.assistant");
  const membership = await getActiveMembership();
  if (!membership) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <AssistantPanel
        businessId={membership.businessId}
        locale={locale as Locale}
        configured={isAssistantConfigured()}
      />
    </div>
  );
}
