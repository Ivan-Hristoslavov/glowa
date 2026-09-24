import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { signInAction } from "@/app/[locale]/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAuthProviders } from "@/lib/supabase/auth-providers";

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

  const { next, error } = await searchParams;
  const t = await getTranslations("auth");
  const providers = await getAuthProviders();
  // Set by /auth/callback and /auth/confirm when a link or a provider fails.
  const linkError =
    error === "oauth" ? t("errors.oauth") : error === "invalid_link" ? t("errors.invalidLink") : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-heading text-2xl">{t("loginTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("loginSubtitle")}</p>
      </div>
      {linkError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{linkError}</AlertDescription>
        </Alert>
      ) : null}
      <AuthForm
        google={providers.google}
        mode="sign-in"
        action={signInAction}
        nextPath={typeof next === "string" ? next : undefined}
      />
    </div>
  );
}
