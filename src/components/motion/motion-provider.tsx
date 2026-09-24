"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Motion for the whole app, on two rules.
 *
 * `LazyMotion` with `domAnimation` and `strict`: components use the small `m`
 * element, and the animation features load once for everyone instead of each
 * island pulling in the full `motion` bundle. `strict` makes importing the
 * heavy `motion.div` by accident a runtime error rather than a silent 30 KB.
 *
 * `reducedMotion="user"`: someone who asked their OS for less motion gets
 * none - transforms are dropped, opacity changes stay. The CSS guard in
 * globals.css does the same for everything that is not driven from here.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
