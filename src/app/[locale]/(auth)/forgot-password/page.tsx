import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requestPasswordReset } from "@/app/[locale]/(auth)/actions";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle"), robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth");

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl">{t("forgotTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("forgotSubtitle")}</p>
      </div>
      <ForgotPasswordForm action={requestPasswordReset} />
    </div>
  );
}
