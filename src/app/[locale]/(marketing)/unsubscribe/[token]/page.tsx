import { CheckCircle2, MailX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { createPublicClient } from "@/lib/supabase/public";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/unsubscribe/[token]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "unsubscribe" });
  // A token in the URL has no business in anyone's index.
  return { title: t("title"), robots: { index: false, follow: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One click from the email, no account, no login, no "are you sure".
 *
 * Unsubscribing on GET is the pragmatic choice here: mail clients and
 * corporate scanners do prefetch links, but an accidental unsubscribe is
 * recoverable in a sentence ("ask the salon to opt you back in") while a
 * two-step flow loses people who genuinely want out. Consent is the salon's to
 * re-obtain, never ours to assume.
 */
export default async function UnsubscribePage({
  params,
}: PageProps<"/[locale]/unsubscribe/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("unsubscribe");

  let businessName: string | null = null;
  let known = false;
  let already = false;

  if (UUID.test(token)) {
    const supabase = createPublicClient();
    const { data } = await supabase.rpc("unsubscribe_marketing", {
      p_token: token,
    });
    const row = data?.[0];
    if (row) {
      known = true;
      businessName = row.business_name;
      already = row.already_unsubscribed;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-20 text-center sm:px-6">
      {known ? (
        <CheckCircle2 className="text-success size-10" aria-hidden />
      ) : (
        <MailX className="text-muted-foreground size-10" aria-hidden />
      )}

      <h1 className="font-heading mt-6 text-3xl text-balance">
        {known
          ? already
            ? t("alreadyTitle")
            : t("doneTitle")
          : t("unknownTitle")}
      </h1>

      <p className="text-muted-foreground mt-4 leading-relaxed text-pretty">
        {known && businessName
          ? already
            ? t("alreadyBody", { business: businessName })
            : t("doneBody", { business: businessName })
          : t("unknownBody")}
      </p>

      {known ? (
        <p className="text-muted-foreground mt-3 text-sm">{t("stillBooked")}</p>
      ) : null}

      <Button asChild variant="outline" className="mt-8">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
