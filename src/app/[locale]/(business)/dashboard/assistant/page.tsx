import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/admin/page-header";
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
      <PageHeader title={t("title")} description={t("subtitle")} />

      <AssistantPanel
        businessId={membership.businessId}
        locale={locale as Locale}
        configured={isAssistantConfigured()}
      />
    </div>
  );
}
