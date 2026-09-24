"use client";

import { CalendarPlus } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type StickyBookBarProps = {
  /** The element whose disappearance off screen brings the bar in. */
  watchId: string;
  href: string;
  label: string;
  name: string;
  detail: string | null;
};

/**
 * Booking is why anyone is on a salon page, and on a phone the button that
 * does it scrolls away within the first swipe - under the services, the team
 * and the reviews someone is reading to decide. This keeps it one tap away
 * once the page's own button is off screen, and gets out of the way when it
 * is back.
 */
export function StickyBookBar({ watchId, href, label, name, detail }: StickyBookBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="bg-background/90 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-heading truncate text-base">{name}</p>
              {detail ? <p className="text-muted-foreground truncate text-xs">{detail}</p> : null}
            </div>
            <Button asChild size="lg" className="shadow-primary/30 shrink-0 shadow-lg">
              <Link href={href}>
                <CalendarPlus className="size-4" aria-hidden />
                {label}
              </Link>
            </Button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
