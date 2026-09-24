"use client";

import { useEffect } from "react";

/**
 * The brand's one signature effect: a warm light that follows the pointer
 * across anything marked `data-glow` (styled by the `glowa-glow` utility).
 *
 * One delegated listener for the whole page rather than one per card, and
 * none at all on touch screens, where there is no pointer to follow.
 */
export function GlowPointer() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;

    function onMove(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const element = target?.closest<HTMLElement>("[data-glow]");
      if (!element) return;
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
      element.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  return null;
}
