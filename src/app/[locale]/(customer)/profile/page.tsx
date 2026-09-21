import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/[locale]/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("profile") };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth");
  const nav = await getTranslations("nav");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  // The proxy already gates this route; this is the second line of defence.
  if (!userId) {
    redirect(`/${locale}/login`);
  }

  // RLS restricts this to the caller's own row - no filter needed for safety,
  // but the explicit `eq` keeps the intent readable and the query planned.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, locale, timezone, created_at")
    .eq("id", userId)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl">{nav("profile")}</h1>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            {t("signOut")}
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{profile?.full_name ?? claimsData?.claims?.email}</CardTitle>
          <CardDescription>{claimsData?.claims?.email as string}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-foreground font-medium">Locale</dt>
            <dd>{profile?.locale ?? locale}</dd>
          </div>
          <div>
            <dt className="text-foreground font-medium">Timezone</dt>
            <dd>{profile?.timezone ?? "Europe/Sofia"}</dd>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
