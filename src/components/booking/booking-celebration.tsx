"use client";

import { m, useReducedMotion } from "motion/react";
import { useEffect } from "react";

type BookingCelebrationProps = {
  title: string;
  body: string;
};

const CONFETTI_COLOURS = ["#d96c61", "#eac2bb", "#a9b6a6", "#f3d9a4", "#ffffff"];

/**
 * The moment a booking lands. It is the one screen everyone who uses GLOWA as
 * a customer sees, and it used to be a grey alert box.
 *
 * The confetti library is loaded on demand, so it costs nothing to anyone who
 * never books, and it is skipped entirely under "reduce motion" - the tick
 * still draws, as a fade.
 */
export function BookingCelebration({ title, body }: BookingCelebrationProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { default: confetti } = await import("canvas-confetti");
      if (cancelled) return;
      const shared = {
        colors: CONFETTI_COLOURS,
        disableForReducedMotion: true,
        scalar: 0.9,
        ticks: 180,
      };
      confetti({ ...shared, particleCount: 70, spread: 70, origin: { x: 0.5, y: 0.25 } });
      window.setTimeout(() => {
        if (cancelled) return;
        confetti({ ...shared, particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.5 } });
        confetti({ ...shared, particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.5 } });
      }, 180);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reduce]);

  return (
    <m.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5 }}
      role="status"
      className="from-accent via-card to-card border-primary/20 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 text-center sm:p-8"
    >
      <div
        aria-hidden
        className="bg-primary/15 pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full blur-3xl"
      />
      <div className="relative mx-auto flex size-16 items-center justify-center">
        <m.span
          className="bg-primary absolute inset-0 rounded-full"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          aria-hidden
        />
        <m.span
          className="border-primary absolute inset-0 rounded-full border-2"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
          aria-hidden
        />
        <svg viewBox="0 0 24 24" className="text-primary-foreground relative size-8" aria-hidden>
          <m.path
            d="M5 12.5l4.2 4.2L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.35, ease: "easeOut" }}
          />
        </svg>
      </div>
      <m.h2
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="font-heading relative mt-4 text-2xl sm:text-3xl"
      >
        {title}
      </m.h2>
      <m.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="text-muted-foreground relative mx-auto mt-2 max-w-md text-sm sm:text-base"
      >
        {body}
      </m.p>
    </m.div>
  );
}
