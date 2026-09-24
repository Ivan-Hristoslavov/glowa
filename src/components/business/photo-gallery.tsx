"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useCallback, useEffect, useState, ViewTransition } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The salon's first impression: its cover and best work, as a mosaic, and a
 * full-screen viewer behind it. On a phone the mosaic collapses to the cover
 * with a count, because five thumbnails at 375px are five smudges.
 */
export function PhotoGallery({
  images,
  name,
  transitionName,
}: {
  images: string[];
  name: string;
  /** Shared with the salon's card in search, so the card grows into this cover. */
  transitionName?: string;
}) {
  const t = useTranslations("business");
  const [index, setIndex] = useState<number | null>(null);

  const open = index !== null;
  const step = useCallback(
    (delta: number) =>
      setIndex((current) =>
        current === null ? current : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  if (images.length === 0) return null;

  const [cover, ...rest] = images;
  const side = rest.slice(0, 4);

  return (
    <>
      <div
        className={cn(
          "relative grid gap-2 overflow-hidden rounded-3xl",
          side.length >= 2 ? "sm:grid-cols-4 sm:grid-rows-2" : "",
          "h-64 sm:h-[26rem]",
        )}
      >
        <ViewTransition name={transitionName} share="salon-cover" default="none">
          <button
            type="button"
            onClick={() => setIndex(0)}
            className={cn(
              "glowa-focus group relative overflow-hidden",
              side.length >= 2 ? "sm:col-span-2 sm:row-span-2" : "",
            )}
            aria-label={t("openPhoto", { number: 1 })}
          >
            <Image
              src={cover}
              alt={name}
              fill
              priority
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          </button>
        </ViewTransition>
        {side.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setIndex(i + 1)}
            className="glowa-focus group relative hidden overflow-hidden sm:block"
            aria-label={t("openPhoto", { number: i + 2 })}
          >
            <Image
              src={src}
              alt={t("photoOf", { name, number: i + 2 })}
              fill
              sizes="25vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          </button>
        ))}

        {images.length > 1 ? (
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="glowa-focus bg-card/90 text-foreground absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-[var(--shadow-lift)] backdrop-blur transition-transform hover:-translate-y-0.5"
          >
            <Images className="size-4" aria-hidden />
            {t("showAllPhotos", { count: images.length })}
          </button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={(next) => !next && setIndex(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(96vw,72rem)] gap-0 overflow-hidden border-0 bg-black p-0 sm:max-w-[min(96vw,72rem)]"
        >
          <DialogTitle className="sr-only">{name}</DialogTitle>
          {index !== null ? (
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
              <Image
                key={images[index]}
                src={images[index]}
                alt=""
                fill
                sizes="96vw"
                className="animate-in fade-in object-contain duration-300"
              />
              <button
                type="button"
                onClick={() => setIndex(null)}
                className="glowa-focus absolute top-3 right-3 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25"
                aria-label={t("closePhotos")}
              >
                <X className="size-5" aria-hidden />
              </button>
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="glowa-focus absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25"
                    aria-label={t("previousPhoto")}
                  >
                    <ChevronLeft className="size-6" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="glowa-focus absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25"
                    aria-label={t("nextPhoto")}
                  >
                    <ChevronRight className="size-6" aria-hidden />
                  </button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white tabular-nums">
                    {index + 1} / {images.length}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
