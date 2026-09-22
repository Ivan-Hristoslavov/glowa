import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { updatePassword } from "@/app/[locale]/(auth)/actions";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle"), robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({
  params,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth");

  // /auth/confirm exchanges the recovery token for a session before sending the
  // user here. Without one there is nothing to update, so the link is stale.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (typeof data?.claims?.sub !== "string") {
    redirect(`/${locale}/forgot-password?error=expired`);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl">{t("resetTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("resetSubtitle")}</p>
      </div>
      <ResetPasswordForm action={updatePassword} />
    </div>
  );
}
