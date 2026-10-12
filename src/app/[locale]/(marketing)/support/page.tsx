import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SupportForm } from "@/components/support/support-form";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("support");
  return { title: t("title") };
}

export default async function SupportPage({
  params,
  searchParams,
}: PageProps<"/[locale]/support">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const t = await getTranslations("support");

  // Someone who is signed in should not have to type who they are.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : "";
  const { data: profile } = userId
    ? await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle()
    : { data: null };

  // Where they were when they asked for help: the page that linked here.
  const from = typeof query.from === "string" ? query.from.slice(0, 300) : "";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-heading text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="text-muted-foreground mt-3 max-w-prose">{t("subtitle")}</p>
      <div className="glowa-card mt-8 p-6 sm:p-8">
        <SupportForm defaultName={profile?.full_name ?? ""} defaultEmail={email} page={from} />
      </div>
    </main>
  );
}
