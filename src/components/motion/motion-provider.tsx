"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";

/**
 * One place that decides how motion behaves across the app.
 *
 * - `LazyMotion` with `domAnimation` ships only the animation features the
 *   interactive surfaces use (the booking funnel, the success moment), not the
 *   full drag/layout bundle; components use the light `m.*` elements.
 * - `reducedMotion="user"` makes every motion component honour the operating
 *   system's "reduce motion" setting: transforms are dropped and only opacity
 *   changes remain. The CSS side has its own global guard in globals.css.
 *
 * Marketing pages deliberately animate with CSS instead (scroll-driven
 * reveals), so their content is visible without JavaScript and never waits
 * for hydration to appear.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
