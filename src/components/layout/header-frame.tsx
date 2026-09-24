"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

const isScrolled = () => window.scrollY > 12;
const serverScrolled = () => false;

/**
 * The header's surface. At the top of a page it is part of the page - no bar,
 * no border. Once the page moves it gathers into a floating glass pill a
 * little narrower than the content, so it reads as something above the page
 * rather than a strip cut out of it.
 *
 * The outer band stays 4rem tall either way: sticky elements further down
 * (the salon page's section tabs) are placed against that height.
 */
export function HeaderFrame({ children }: { children: React.ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, isScrolled, serverScrolled);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center px-2 sm:px-4">
      <div
        data-scrolled={scrolled ? "" : undefined}
        className={cn(
          "mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 rounded-full border border-transparent pr-1.5 pl-3 sm:pl-4",
          "transition-[max-width,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled &&
            "bg-background/75 border-border/70 max-w-5xl shadow-[0_12px_40px_-18px_rgb(17_17_20/0.35)] backdrop-blur-xl backdrop-saturate-150",
        )}
      >
        {children}
      </div>
    </header>
  );
}
