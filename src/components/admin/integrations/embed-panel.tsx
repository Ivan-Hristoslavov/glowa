"use client";

import { useTranslations } from "next-intl";

import { Section } from "@/components/common/section";

import { CopyBlock } from "./shared";

export function EmbedPanel({
  siteUrl,
  slug,
  locale,
}: {
  siteUrl: string;
  slug: string;
  locale: string;
}) {
  const t = useTranslations("admin.integrations.embed");
  const bookUrl = `${siteUrl}/${locale}/business/${slug}/book`;
  const label = t("buttonText");

  const link = `<a href="${bookUrl}" target="_blank" rel="noopener">${label}</a>`;
  const script = [
    `<script async src="${siteUrl}/embed.js"`,
    `  data-lavena-salon="${slug}" data-lavena-locale="${locale}"></script>`,
    `<button type="button" data-lavena-book>${label}</button>`,
  ].join("\n");

  return (
    <Section id="embed" title={t("title")} description={t("description")}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("linkTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("linkBody")}</p>
          <CopyBlock value={link} label="HTML" multiline />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("scriptTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("scriptBody")}</p>
          <CopyBlock value={script} label="HTML" multiline />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{t("note")}</p>
    </Section>
  );
}
