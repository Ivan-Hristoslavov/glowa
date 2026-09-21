import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { signUpAction } from "@/app/[locale]/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signUp") };
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth");

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl">{t("signupTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("signupSubtitle")}</p>
      </div>
      <AuthForm mode="sign-up" action={signUpAction} />
    </div>
  );
}
