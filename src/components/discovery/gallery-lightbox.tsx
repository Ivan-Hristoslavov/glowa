"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type GalleryLightboxProps = {
  urls: string[];
  businessName: string;
};

/**
 * The salon's photos as a grid that opens full screen.
 *
 * Photos are how people choose a stylist, and a 200px square does not show
 * a fade or a set of nails. Arrows, the keyboard and a swipe move between
 * them; Escape or the close button returns to the page where it was.
 */
export function GalleryLightbox({ urls, businessName }: GalleryLightboxProps) {
  const t = useTranslations("business");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // Which way the photo leaves, so the next one slides in from the other side.
  const [direction, setDirection] = useState(1);
  const touchX = useRef<number | null>(null);

  const total = urls.length;
  const go = useCallback(
    (step: number) => {
      setDirection(step);
      setIndex((current) => (current + step + total) % total);
    },
    [total],
  );

  function show(at: number) {
    setDirection(1);
    setIndex(at);
    setOpen(true);
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {urls.map((url, at) => (
          <li key={url}>
            <button
              type="button"
              onClick={() => show(at)}
              aria-label={t("galleryOpen", { n: at + 1, total })}
              className="glowa-focus bg-secondary group relative block aspect-square w-full overflow-hidden rounded-xl"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(min-width: 640px) 20vw, 45vw"
                loading={at < 3 ? undefined : "lazy"}
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
            </button>
          </li>
        ))}
      </ul>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/90 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex flex-col outline-none"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") go(1);
              if (event.key === "ArrowLeft") go(-1);
            }}
            onTouchStart={(event) => {
              touchX.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const start = touchX.current;
              const end = event.changedTouches[0]?.clientX;
              touchX.current = null;
              if (start === null || end === undefined) return;
              if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              {t("galleryTitle", { business: businessName })}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {t("galleryHint")}
            </DialogPrimitive.Description>

            <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
              <span className="tabular-nums" aria-live="polite">
                {t("galleryCounter", { n: index + 1, total })}
              </span>
              <DialogPrimitive.Close
                className="glowa-focus inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                aria-label={t("galleryClose")}
              >
                <X className="size-5" aria-hidden />
              </DialogPrimitive.Close>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <m.div
                  key={urls[index]}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -60 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-4 sm:inset-x-20 sm:inset-y-4"
                >
                  <Image
                    src={urls[index]}
                    alt={t("galleryPhotoAlt", { business: businessName, n: index + 1 })}
                    fill
                    sizes="100vw"
                    className="object-contain"
                    priority
                  />
                </m.div>
              </AnimatePresence>

              {total > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label={t("galleryPrev")}
                    className="glowa-focus absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:inline-flex"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label={t("galleryNext")}
                    className="glowa-focus absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:inline-flex"
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>

            {total > 1 ? (
              <ol className="flex justify-center gap-2 overflow-x-auto px-4 py-4">
                {urls.map((url, at) => (
                  <li key={url}>
                    <button
                      type="button"
                      onClick={() => {
                        setDirection(at >= index ? 1 : -1);
                        setIndex(at);
                      }}
                      aria-label={t("galleryOpen", { n: at + 1, total })}
                      aria-current={at === index ? "true" : undefined}
                      className={cn(
                        "glowa-focus relative block size-12 overflow-hidden rounded-lg transition-opacity",
                        at === index ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-80",
                      )}
                    >
                      <Image src={url} alt="" fill sizes="48px" className="object-cover" />
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
