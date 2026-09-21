import { CalendarCheck, Check, ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GlowaMark } from "@/components/brand/glowa-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");

  const badges = [
    { key: "noCard", icon: ShieldCheck },
    { key: "fastSetup", icon: CalendarCheck },
    { key: "localSupport", icon: Sparkles },
  ] as const;

  return (
    <main>
      <section className="relative overflow-hidden">
        {/* Soft brand washes rather than a flat block of colour. */}
        <div
          aria-hidden
          className="bg-brand-soft/45 pointer-events-none absolute -top-40 -right-32 size-[26rem] rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="bg-brand-sage/35 pointer-events-none absolute -bottom-52 -left-40 size-[24rem] rounded-full blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
          <p className="text-primary text-xs font-semibold tracking-[0.28em] uppercase">
            {t("eyebrow")}
          </p>

          <h1 className="font-heading mt-5 max-w-3xl text-4xl leading-[1.05] text-balance sm:text-6xl">
            <span className="block">{t("titleLine1")}</span>
            <span className="text-primary block">{t("titleLine2")}</span>
          </h1>

          <p className="text-muted-foreground mt-6 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
            {t("subtitle")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">{t("ctaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">{t("ctaSecondary")}</Link>
            </Button>
          </div>

          <ul className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {badges.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-2">
                <Icon className="text-primary size-4" aria-hidden />
                {t(`badges.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* An honest build-status panel. No invented traction numbers: the
          product has none yet, and the brief forbids inventing them. */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
        <div className="glowa-card flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-8 sm:p-8">
          <GlowaMark className="size-10 shrink-0" />
          <div className="flex-1">
            <Badge variant="secondary" className="mb-3">
              {t("foundation.status")}
            </Badge>
            <h2 className="font-heading text-xl">{t("foundation.title")}</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              {t("foundation.body")}
            </p>
            <ul className="text-muted-foreground mt-5 grid gap-2 text-sm sm:grid-cols-2">
              {[
                "Next.js · TypeScript · Tailwind · shadcn/ui",
                "Supabase · migrations · Row Level Security",
                "BG / EN / RO via i18n keys",
                "GLOWA tokens · light and dark",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="text-primary size-4 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
