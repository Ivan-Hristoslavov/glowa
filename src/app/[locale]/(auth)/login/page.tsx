import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { signInAction } from "@/app/[locale]/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { next } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl">{t("loginTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("loginSubtitle")}</p>
      </div>
      <AuthForm
        mode="sign-in"
        action={signInAction}
        nextPath={typeof next === "string" ? next : undefined}
      />
    </div>
  );
}
