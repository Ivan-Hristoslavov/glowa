import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  Globe,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Undo2,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { FEATURE_ICONS, type FeatureIconKey } from "@/components/brand/feature-icons";
import { WhyPay } from "@/components/marketing/why-pay";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { showcaseAssets } from "@/lib/brand-assets";
import { getBusinessBySlug } from "@/lib/queries/discovery";
import { alternatesFor } from "@/lib/seo/structured-data";

/** The furnished demo salon, when this environment has one. */
const SHOWCASE_SLUG = "demo-ivanov-atelier";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/for-business">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("forBusiness");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor(`/${locale}/for-business`),
  };
}

const INCLUDED: FeatureIconKey[] = [
  "booking",
  "teamCalendar",
  "clients",
  "payments",
  "marketing",
  "analytics",
  "assistant",
];

type MockLabels = {
  day: string;
  dayView: string;
  weekView: string;
  services: [string, string, string, string, string, string];
};

/**
 * Illustrative calendar, drawn in the product's own style. Every time on it is
 * invented for the picture, so it is hidden from assistive tech entirely.
 */
function CalendarMock({ labels }: { labels: MockLabels }) {
  const [balayage, cut, styling, colour, keratin, brows] = labels.services;
  const columns = [
    {
      color: "#C8745F",
      avatar: showcaseAssets.staff[0],
      blocks: [
        { top: 4, height: 30, label: balayage, sub: "09:00 – 12:00" },
        { top: 40, height: 14, label: cut, sub: "12:30" },
        { top: 60, height: 20, label: styling, sub: "14:00" },
      ],
    },
    {
      color: "#4F7CA8",
      avatar: showcaseAssets.staff[1],
      blocks: [
        { top: 12, height: 22, label: colour, sub: "10:00 – 12:00" },
        { top: 44, height: 26, label: keratin, sub: "13:00 – 15:30" },
      ],
    },
    {
      color: "#5E9A78",
      avatar: showcaseAssets.staff[3],
      blocks: [
        { top: 6, height: 10, label: brows, sub: "09:30" },
        { top: 22, height: 12, label: brows, sub: "11:00" },
        { top: 52, height: 10, label: brows, sub: "14:30" },
        { top: 70, height: 12, label: brows, sub: "16:00" },
      ],
    },
  ];

  return (
    <div aria-hidden className="bg-card overflow-hidden rounded-2xl border shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-heading text-base">{labels.day}</span>
        <span className="bg-muted flex gap-1 rounded-full p-0.5 text-[0.65rem]">
          <span className="bg-card rounded-full px-2 py-0.5 shadow-sm">{labels.dayView}</span>
          <span className="text-muted-foreground px-2 py-0.5">{labels.weekView}</span>
        </span>
      </div>
      <div className="relative grid grid-cols-3">
        {columns.map((column, index) => (
          <div key={index} className="border-r last:border-r-0">
            <div className="flex items-center justify-center border-b py-2">
              <span className="rounded-full p-0.5" style={{ boxShadow: `0 0 0 2px ${column.color}` }}>
                <Image
                  src={column.avatar}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 rounded-full object-cover"
                />
              </span>
            </div>
            <div className="relative h-64">
              {column.blocks.map((block, i) => (
                <div
                  key={i}
                  className="absolute right-1 left-1 overflow-hidden rounded-md border px-1.5 py-1 text-[0.6rem] leading-tight"
                  style={{
                    top: `${block.top}%`,
                    height: `${block.height}%`,
                    backgroundColor: `color-mix(in oklab, ${column.color} 16%, var(--card))`,
                    borderColor: `color-mix(in oklab, ${column.color} 38%, var(--card))`,
                    borderLeft: `3px solid ${column.color}`,
                  }}
                >
                  <span className="block truncate font-semibold">{block.label}</span>
                  <span className="text-muted-foreground">{block.sub}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Now */}
        <div className="pointer-events-none absolute inset-x-0 top-[calc(2.75rem+38%)] flex items-center">
          <span className="bg-primary -ml-1 size-2 rounded-full" />
          <span className="bg-primary h-0.5 flex-1" />
        </div>
      </div>
    </div>
  );
}

export default async function ForBusinessPage({
  params,
}: PageProps<"/[locale]/for-business">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("forBusiness");
  const features = await getTranslations("home.features");
  const showcase = await getBusinessBySlug(SHOWCASE_SLUG).catch(() => null);

  const pillars = [
    {
      key: "calendar",
      icon: CalendarDays,
      visual: (
        <CalendarMock
          labels={{
            day: t("mock.calendarDay"),
            dayView: t("mock.dayView"),
            weekView: t("mock.weekView"),
            services: [
              t("mock.services.balayage"),
              t("mock.services.cut"),
              t("mock.services.styling"),
              t("mock.services.colour"),
              t("mock.services.keratin"),
              t("mock.services.brows"),
            ],
          }}
        />
      ),
    },
    {
      key: "deposits",
      icon: ShieldCheck,
      visual: (
        <div aria-hidden className="space-y-3">
          {[
            { icon: ShieldCheck, tone: "text-success bg-success/12", key: "depositPaid" },
            { icon: Undo2, tone: "text-primary bg-primary/12", key: "depositRefund" },
            { icon: Sparkles, tone: "text-warning bg-warning/14", key: "depositKept" },
          ].map((row, index) => (
            <Reveal key={row.key} onView delay={index * 0.1}>
              <div className="bg-card flex items-center gap-4 rounded-2xl border p-4 shadow-[var(--shadow-card)]">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${row.tone}`}>
                  <row.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{t(`mock.${row.key}.title`)}</p>
                  <p className="text-muted-foreground text-sm">{t(`mock.${row.key}.body`)}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      ),
    },
    {
      key: "showcase",
      icon: Globe,
      visual: (
        <div aria-hidden className="grid grid-cols-3 grid-rows-2 gap-2 overflow-hidden rounded-3xl">
          <div className="relative col-span-2 row-span-2 aspect-square">
            <Image src={showcaseAssets.cover} alt="" fill sizes="30vw" className="object-cover" />
          </div>
          <div className="relative aspect-square">
            <Image src={showcaseAssets.gallery[0]} alt="" fill sizes="15vw" className="object-cover" />
          </div>
          <div className="relative aspect-square">
            <Image src={showcaseAssets.gallery[3]} alt="" fill sizes="15vw" className="object-cover" />
          </div>
        </div>
      ),
    },
  ] as const;

  return (
    <main className="overflow-hidden">
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative">
        <div
          className="from-brand-soft/40 pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-gradient-to-b to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-20">
          <Reveal>
            <p className="text-primary text-xs font-semibold tracking-[0.24em] uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="font-heading mt-5 text-4xl leading-[1.08] text-balance sm:text-6xl">
              {t("title")} <span className="text-primary">{t("titleAccent")}</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed text-pretty">
              {t("subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                <Link href="/signup">
                  {t("ctaPrimary")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              {showcase ? (
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-7 text-base">
                  <Link href={`/business/${SHOWCASE_SLUG}`}>{t("ctaShowcase")}</Link>
                </Button>
              ) : null}
            </div>
            <ul className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {(["heroPoint1", "heroPoint2", "heroPoint3"] as const).map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <Check className="text-primary size-4" aria-hidden />
                  {t(key)}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="relative">
            <Reveal delay={0.15}>
              <div className="relative aspect-[4/3.2] overflow-hidden rounded-3xl shadow-[var(--shadow-pop)]">
                <Image
                  src={showcaseAssets.cover}
                  alt={t("heroAlt")}
                  fill
                  priority
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
            <Reveal delay={0.35} className="absolute -bottom-8 -left-4 w-60 sm:-left-10 sm:w-72">
              <div className="bg-card rounded-2xl border p-4 shadow-[var(--shadow-pop)]" aria-hidden>
                <p className="text-muted-foreground text-[0.7rem] tracking-[0.14em] uppercase">
                  {t("mock.nextUp")}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <Image
                    src={showcaseAssets.staff[0]}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t("mock.nextService")}</p>
                    <p className="text-muted-foreground text-xs">10:30 · 3 h</p>
                  </div>
                </div>
                <p className="text-success mt-3 flex items-center gap-1.5 text-xs font-medium">
                  <ShieldCheck className="size-3.5" />
                  {t("mock.depositPaid.title")}
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.5} className="absolute -top-6 -right-2 sm:-right-6">
              <div
                className="bg-card flex items-center gap-2 rounded-full border px-4 py-2 shadow-[var(--shadow-lift)]"
                aria-hidden
              >
                <BellRing className="text-primary size-4" />
                <span className="text-sm font-medium">{t("mock.newBooking")}</span>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- pillars */}
      <section className="mx-auto w-full max-w-6xl space-y-24 px-4 py-16 sm:px-6 sm:py-24">
        {pillars.map((pillar, index) => (
          <div
            key={pillar.key}
            className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16"
          >
            <Reveal onView className={index % 2 === 1 ? "lg:order-2" : undefined}>
              <span className="bg-primary/12 text-primary inline-flex size-12 items-center justify-center rounded-2xl">
                <pillar.icon className="size-6" aria-hidden />
              </span>
              <h2 className="font-heading mt-5 text-3xl leading-tight text-balance sm:text-4xl">
                {t(`pillars.${pillar.key}.title`)}
              </h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
                {t(`pillars.${pillar.key}.body`)}
              </p>
              <ul className="mt-6 space-y-3">
                {(["point1", "point2", "point3"] as const).map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="bg-primary/12 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3" aria-hidden />
                    </span>
                    <span>{t(`pillars.${pillar.key}.${point}`)}</span>
                  </li>
                ))}
              </ul>
              {pillar.key === "showcase" && showcase ? (
                <Button asChild variant="outline" className="mt-7 rounded-full">
                  <Link href={`/business/${SHOWCASE_SLUG}`}>
                    {t("ctaShowcase")}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </Reveal>
            <Reveal onView delay={0.1}>
              {pillar.visual}
            </Reveal>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------------- why pay */}
      <div className="px-4 pb-16 sm:px-6 sm:pb-24">
        <WhyPay pricingLink />
      </div>

      {/* ------------------------------------------------------------ included */}
      <section className="bg-card/60 border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl leading-tight sm:text-4xl">{t("included.title")}</h2>
            <p className="text-muted-foreground mt-3 text-lg">{t("included.subtitle")}</p>
          </div>
          <Stagger onView className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INCLUDED.map((key) => {
              const Icon = FEATURE_ICONS[key];
              return (
                <StaggerItem key={key}>
                  <div className="bg-card hover:shadow-lift h-full rounded-2xl border p-5 transition-shadow duration-300">
                    <span className="bg-secondary text-primary flex size-11 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 font-medium">{features(`${key}.title`)}</h3>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                      {features(`${key}.body`)}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
            <StaggerItem>
              <div className="bg-card hover:shadow-lift h-full rounded-2xl border p-5 transition-shadow duration-300">
                <span className="bg-secondary text-primary flex size-11 items-center justify-center rounded-xl">
                  <QrCode className="size-5" />
                </span>
                <h3 className="mt-4 font-medium">{t("included.qr.title")}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  {t("included.qr.body")}
                </p>
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* --------------------------------------------------------------- steps */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="font-heading text-center text-3xl leading-tight sm:text-4xl">
          {t("steps.title")}
        </h2>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {(["one", "two", "three"] as const).map((step, index) => (
            <li key={step}>
              <Reveal onView delay={index * 0.1} className="h-full">
                <div data-glow className="glowa-card glowa-glow relative h-full rounded-2xl p-6">
                  <span className="font-heading text-primary/25 absolute top-4 right-5 text-6xl leading-none">
                    {index + 1}
                  </span>
                  <h3 className="font-heading text-xl">{t(`steps.${step}.title`)}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    {t(`steps.${step}.body`)}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------------------------- faq */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 className="font-heading text-3xl sm:text-4xl">{t("faq.title")}</h2>
        <Accordion type="single" collapsible className="mt-6">
          {(["price", "stripe", "phone", "clients"] as const).map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="text-left text-base">{t(`faq.${key}.q`)}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {t(`faq.${key}.a`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ----------------------------------------------------------------- cta */}
      <section className="px-4 pb-20 sm:px-6">
        <Reveal onView>
          <div className="from-primary relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br to-[#b8554b] px-6 py-14 text-center text-white shadow-[var(--shadow-pop)] sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -right-20 -bottom-24 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <Star className="mx-auto size-8 opacity-80" aria-hidden />
            <h2 className="font-heading mx-auto mt-4 max-w-2xl text-3xl leading-tight text-balance sm:text-5xl">
              {t("cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">{t("cta.body")}</p>
            <Button
              asChild
              size="lg"
              className="text-primary mt-8 h-12 rounded-full bg-white px-8 text-base hover:bg-white/90"
            >
              <Link href="/signup">
                {t("ctaPrimary")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
