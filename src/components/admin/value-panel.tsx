import { ArrowRight, CalendarCheck, Globe, Repeat, ShieldCheck, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import type { ValueSummary } from "@/lib/queries/business";

/**
 * "What GLOWA brought you this month". The subscription has to earn its place
 * next to platforms that charge nothing up front, and this is where it shows
 * its work: every figure is a count of the salon's own bookings, with the
 * attribution rule written underneath rather than hidden.
 */
export async function ValuePanel({
  summary,
  locale,
}: {
  summary: ValueSummary;
  locale: Locale;
}) {
  const t = await getTranslations("admin.dashboard.value");
  const currency = summary.currency ?? "EUR";
  const money = (cents: number) => formatPrice(Number(cents), currency, locale) ?? "0";

  const tiles: {
    key: string;
    icon: LucideIcon;
    value: string;
    label: string;
    hint: string;
  }[] = [
    {
      key: "online",
      icon: Globe,
      value: String(summary.online_bookings),
      label: t("online"),
      hint: t("worth", { amount: money(summary.online_value_cents) }),
    },
    {
      key: "invited",
      icon: Repeat,
      value: String(summary.invited_bookings),
      label: t("invited"),
      hint: `${t("worth", { amount: money(summary.invited_value_cents) })} · ${t("invitationsSent", {
        count: summary.invitations_sent,
      })}`,
    },
    {
      key: "refilled",
      icon: CalendarCheck,
      value: String(summary.refilled_bookings),
      label: t("refilled"),
      hint: t("refilledHint"),
    },
    {
      key: "kept",
      icon: ShieldCheck,
      value: money(summary.deposits_kept_cents),
      label: t("kept"),
      hint: t("keptHint"),
    },
  ];

  return (
    <section
      aria-labelledby="value-panel-title"
      className="glowa-card relative overflow-hidden rounded-2xl"
    >
      <div
        className="from-primary/12 pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div className="space-y-1">
          <h2 id="value-panel-title" className="font-heading text-xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        {summary.rebookServices === 0 ? (
          <Link
            href="/dashboard/services"
            className="bg-card text-primary glowa-focus inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:underline"
          >
            {t("rebookOff")} {t("rebookOffCta")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <dl className="relative grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="bg-card/80 rounded-xl border p-4">
            <dt className="text-muted-foreground flex items-center gap-2 text-sm">
              <span className="bg-primary/12 text-primary flex size-7 shrink-0 items-center justify-center rounded-lg">
                <tile.icon className="size-3.5" aria-hidden />
              </span>
              {tile.label}
            </dt>
            <dd className="mt-3">
              <span className="font-heading block text-3xl leading-none tabular-nums">
                {tile.value}
              </span>
              <span className="text-muted-foreground mt-2 block text-xs">{tile.hint}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-muted-foreground relative border-t px-5 py-3 text-xs leading-relaxed">
        {t("footnote")}
      </p>
    </section>
  );
}
