import { Bell, CalendarCheck2, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { brandAssets } from "@/lib/brand-assets";

/**
 * The hero photograph with the product floating over it.
 *
 * The cards are an illustration of what booking looks like - a confirmation,
 * the day's free times, a reminder - drawn in HTML so they are crisp, themed
 * and translated. They carry no numbers about GLOWA itself: no ratings, no
 * customer counts, nothing that would read as traction. The caption says it
 * is a preview.
 *
 * All motion is CSS, so the hero is complete in the server HTML and nothing
 * waits for hydration to appear.
 */
export async function HeroShowcase() {
  const t = await getTranslations("home");
  const times = ["10:30", "13:15", "14:30", "16:45"];

  return (
    <div className="relative">
      <div
        className="glowa-enter relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[var(--shadow-pop)] sm:aspect-[4/3] lg:aspect-[4/5]"
        style={{ "--delay": "150ms" } as React.CSSProperties}
      >
        {/* Two exposures of the same scene rather than one image dimmed by
            CSS: the dark theme gets a photograph actually lit for it. The
            swap is class-based, so server and client render the same markup. */}
        <Image
          src={brandAssets.heroLight}
          alt={t("heroAlt")}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="object-cover dark:hidden"
        />
        <Image
          src={brandAssets.heroDark}
          alt={t("heroAlt")}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="hidden object-cover dark:block"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
        />
      </div>

      {/* Free times today */}
      <div
        aria-hidden
        className="glowa-enter absolute top-5 -left-3 w-56 sm:-left-8 sm:top-8"
        style={{ "--delay": "550ms" } as React.CSSProperties}
      >
        <div
          className="glowa-float bg-card/90 rounded-2xl border p-3.5 shadow-[var(--shadow-lift)] backdrop-blur-md"
          style={{ "--delay": "0ms" } as React.CSSProperties}
        >
          <p className="text-muted-foreground flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide uppercase">
            <span className="relative flex size-2">
              <span className="bg-success absolute inset-0 animate-ping rounded-full opacity-60" />
              <span className="bg-success relative size-2 rounded-full" />
            </span>
            {t("mock.freeToday")}
          </p>
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {times.map((time, index) => (
              <span
                key={time}
                className={
                  index === 2
                    ? "bg-primary text-primary-foreground rounded-lg py-1.5 text-center text-[0.7rem] font-semibold tabular-nums"
                    : "bg-secondary text-secondary-foreground rounded-lg py-1.5 text-center text-[0.7rem] font-medium tabular-nums"
                }
              >
                {time}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation */}
      <div
        aria-hidden
        className="glowa-enter absolute -right-3 bottom-24 w-[17.5rem] sm:-right-6 sm:bottom-28"
        style={{ "--delay": "800ms" } as React.CSSProperties}
      >
        <div
          className="glowa-float bg-card/95 flex items-center gap-3 rounded-2xl border p-3.5 shadow-[var(--shadow-pop)] backdrop-blur-md"
          style={{ "--delay": "1.2s" } as React.CSSProperties}
        >
          <span className="bg-primary text-primary-foreground relative flex size-10 shrink-0 items-center justify-center rounded-full">
            <Check className="size-5" strokeWidth={2.6} />
            <span className="border-primary absolute inset-0 animate-[glowa-pulse-ring_2.4s_ease-out_infinite] rounded-full border-2" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("mock.confirmed")}</p>
            <p className="text-muted-foreground truncate text-xs">
              {t("mock.service")} · {t("mock.when")}
            </p>
          </div>
        </div>
      </div>

      {/* Reminder */}
      <div
        aria-hidden
        className="glowa-enter absolute bottom-6 -left-4 hidden w-64 sm:block sm:-left-8"
        style={{ "--delay": "1050ms" } as React.CSSProperties}
      >
        <div
          className="glowa-float bg-foreground text-background flex items-center gap-3 rounded-2xl p-3 shadow-[var(--shadow-pop)]"
          style={{ "--delay": "2.4s" } as React.CSSProperties}
        >
          <span className="bg-background/15 flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Bell className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-medium tracking-wide uppercase opacity-70">
              {t("mock.reminder")}
            </p>
            <p className="text-sm leading-snug font-medium">{t("mock.reminderBody")}</p>
          </div>
          <CalendarCheck2 className="ml-auto size-4 shrink-0 opacity-60" />
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-center text-[0.68rem] tracking-[0.16em] uppercase lg:text-right">
        {t("mock.caption")}
      </p>
    </div>
  );
}
