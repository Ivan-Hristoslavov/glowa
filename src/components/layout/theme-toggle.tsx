"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/utils";

/** Every transition is off while the page repaints, except the icon's own. */
const FREEZE_CSS =
  "*:not([data-theme-icon],[data-theme-icon] *),*::before,*::after{transition:none!important}";

/**
 * One tap between light and dark.
 *
 * The icon morphs - the sun's rays draw in and a shadow slides across its
 * disc to leave a crescent - and the new theme spreads out from the button
 * as a circle, using the View Transitions API. Where that API is missing, or
 * the visitor has asked for less motion, the switch is simply instant.
 *
 * Which icon shows is decided by the `dark` class on <html>, not by React
 * state, so server and client render the same markup and nothing flashes.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const { resolvedTheme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const maskId = useId();

  function apply(next: "light" | "dark") {
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.classList.toggle("light", next === "light");
    root.style.colorScheme = next;
    setTheme(next);
  }

  function toggle() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") || resolvedTheme === "dark" ? "light" : "dark";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof document.startViewTransition !== "function") {
      apply(next);
      return;
    }

    // Colours would otherwise fade at their own speeds under the reveal.
    const freeze = document.createElement("style");
    freeze.textContent = FREEZE_CSS;
    document.head.appendChild(freeze);
    root.dataset.themeSwitch = "";

    const transition = document.startViewTransition(() => {
      flushSync(() => apply(next));
    });

    transition.ready
      .then(() => {
        const rect = buttonRef.current?.getBoundingClientRect();
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const y = rect ? rect.top + rect.height / 2 : 0;
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );
        root.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: 650,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => undefined);

    transition.finished.finally(() => {
      freeze.remove();
      delete root.dataset.themeSwitch;
    });
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label={t("toggleTheme")}
      title={t("toggleTheme")}
      className={cn(
        "glowa-focus hover:bg-muted relative inline-flex size-9 items-center justify-center rounded-full transition-colors",
        className,
      )}
    >
      <svg
        data-theme-icon=""
        viewBox="0 0 24 24"
        aria-hidden
        className="size-[1.15rem] rotate-90 transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:rotate-0"
      >
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          {/* The shadow that turns the sun into a moon: parked off the disc
              in light mode, slid across it in dark. */}
          <circle
            cx="17"
            cy="7"
            r="7.5"
            fill="black"
            className="translate-x-[9px] -translate-y-[9px] transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] dark:translate-x-0 dark:translate-y-0"
          />
        </mask>
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="currentColor"
          mask={`url(#${maskId})`}
          className="scale-[0.5] transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] [transform-box:fill-box] origin-center dark:scale-100"
        />
        <g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="scale-100 rotate-0 opacity-100 transition-[scale,rotate,opacity] duration-500 [transform-box:view-box] origin-center dark:scale-50 dark:rotate-90 dark:opacity-0"
        >
          <path d="M12 1.5v2.2M12 20.3v2.2M1.5 12h2.2M20.3 12h2.2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" />
        </g>
      </svg>
    </button>
  );
}
