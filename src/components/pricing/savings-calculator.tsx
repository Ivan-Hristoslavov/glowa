"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { localeHrefLang, type Locale } from "@/i18n/routing";
import { glowaMonthlyCents, typicalMonthlyCents } from "@/lib/pricing";

function euros(cents: number, locale: Locale) {
  return new Intl.NumberFormat(localeHrefLang[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
};

function Slider({ label, value, min, max, step = 1, display, onChange }: SliderProps) {
  const id = useId();
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="font-heading text-lg tabular-nums">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="glowa-focus accent-primary h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, var(--primary) ${percent}%, var(--muted) ${percent}%)`,
        }}
      />
    </div>
  );
}

/**
 * "What would this cost me elsewhere?" answered with the salon's own numbers.
 *
 * The comparison uses the lowest published rates of a large marketplace
 * platform (`TYPICAL_PLATFORM`), rounded in its favour, and says so under the
 * result - a saving that turns out to be exaggerated would cost more trust
 * than it wins.
 */
export function SavingsCalculator() {
  const t = useTranslations("pricing.calculator");
  const locale = useLocale() as Locale;
  const [seats, setSeats] = useState(3);
  const [newClients, setNewClients] = useState(15);
  const [average, setAverage] = useState(40);

  const theirs = typicalMonthlyCents(seats, newClients, average * 100);
  const ours = glowaMonthlyCents(seats);
  const saved = Math.max(0, theirs - ours);

  return (
    <section
      aria-labelledby="calculator-title"
      className="glowa-card relative overflow-hidden rounded-3xl p-6 sm:p-10"
    >
      <div
        aria-hidden
        className="bg-brand-peach/60 pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-3xl"
      />
      <div className="relative grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="space-y-7">
          <div>
            <h2 id="calculator-title" className="font-heading text-2xl sm:text-3xl">
              {t("title")}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t("subtitle")}</p>
          </div>
          <Slider
            label={t("seats")}
            value={seats}
            min={1}
            max={15}
            display={String(seats)}
            onChange={setSeats}
          />
          <Slider
            label={t("newClients")}
            value={newClients}
            min={0}
            max={60}
            display={String(newClients)}
            onChange={setNewClients}
          />
          <Slider
            label={t("average")}
            value={average}
            min={10}
            max={150}
            step={5}
            display={euros(average * 100, locale)}
            onChange={setAverage}
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/70 rounded-2xl p-4">
              <p className="text-muted-foreground text-xs">{t("theirs")}</p>
              <p className="font-heading mt-1 text-2xl tabular-nums line-through decoration-2 opacity-70">
                {euros(theirs, locale)}
              </p>
              <p className="text-muted-foreground text-xs">{t("perMonth")}</p>
            </div>
            <div className="bg-primary/10 rounded-2xl p-4">
              <p className="text-primary text-xs font-semibold">{t("ours")}</p>
              <p className="font-heading mt-1 text-2xl tabular-nums">{euros(ours, locale)}</p>
              <p className="text-muted-foreground text-xs">{t("perMonth")}</p>
            </div>
          </div>
          <div className="bg-foreground text-background rounded-2xl p-6" aria-live="polite">
            <p className="text-sm opacity-75">{t("savedYear")}</p>
            <p className="font-heading mt-1 text-5xl tabular-nums">{euros(saved * 12, locale)}</p>
            <p className="mt-2 text-sm opacity-75">
              {t("savedMonth", { amount: euros(saved, locale) })}
            </p>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{t("assumptions")}</p>
        </div>
      </div>
    </section>
  );
}
