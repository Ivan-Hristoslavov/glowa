"use client";

import { m, type HTMLMotionProps } from "motion/react";

type RevealProps = HTMLMotionProps<"div"> & {
  /** Seconds to wait before starting, for staggering siblings by hand. */
  delay?: number;
  /** Animate when scrolled into view rather than on mount. */
  onView?: boolean;
};

/**
 * A short rise-and-fade. The one entrance used across the product, so every
 * surface arrives the same way: 12px, 0.5s, the brand curve. The markup is
 * server-rendered in full (crawlers and screen readers get all of it); only
 * the paint waits for the entrance. Keep it off anything a visitor needs in
 * the first frame, like the booking button.
 */
export function Reveal({ delay = 0, onView = false, children, ...rest }: RevealProps) {
  const target = { opacity: 1, y: 0 };
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      {...(onView
        ? { whileInView: target, viewport: { once: true, margin: "-60px" } }
        : { animate: target })}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </m.div>
  );
}

/** Children rise one after another. */
export function Stagger({
  children,
  step = 0.06,
  onView = false,
  ...rest
}: HTMLMotionProps<"div"> & { step?: number; onView?: boolean }) {
  return (
    <m.div
      initial="hidden"
      {...(onView
        ? { whileInView: "shown", viewport: { once: true, margin: "-60px" } }
        : { animate: "shown" })}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: step } } }}
      {...rest}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <m.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
      {...rest}
    >
      {children}
    </m.div>
  );
}
