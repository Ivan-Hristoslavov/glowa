"use client";

import { ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { updateBusinessMedia } from "@/lib/actions/business";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "business-media";
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY = 12;

type Props = {
  businessId: string;
  initialCover: string | null;
  initialGallery: string[];
};

/** The storage path of one of our own uploads, or null for anything else. */
function storagePath(url: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}

/**
 * The salon's photographs: one cover, up to twelve more.
 *
 * Photographs are what sells a salon on its page, so this is built for the
 * owner with a phone full of pictures: pick several at once, the first becomes
 * the cover if there is none, and any photo can be promoted to cover with one
 * tap. Every change is saved as it happens - there is no second step to miss.
 */
export function BusinessMediaManager({ businessId, initialCover, initialGallery }: Props) {
  const t = useTranslations("admin.media");
  const router = useRouter();
  const [cover, setCover] = useState<string | null>(initialCover);
  const [gallery, setGallery] = useState<string[]>(initialGallery);
  const [uploading, setUploading] = useState(0);
  const [isPending, startTransition] = useTransition();
  const galleryInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const busy = uploading > 0 || isPending;
  const room = MAX_GALLERY - gallery.length;

  function persist(nextCover: string | null, nextGallery: string[], removed: string[] = []) {
    const previous = { cover, gallery };
    setCover(nextCover);
    setGallery(nextGallery);
    startTransition(async () => {
      const result = await updateBusinessMedia({
        businessId,
        coverImageUrl: nextCover,
        gallery: nextGallery,
      });
      if (!result.ok) {
        setCover(previous.cover);
        setGallery(previous.gallery);
        toast.error(t("error"));
        return;
      }
      // The page no longer points at these, so the files can go too. A file
      // that fails to delete is only wasted space, never a broken page.
      const paths = removed.map(storagePath).filter((path): path is string => Boolean(path));
      if (paths.length > 0) {
        void createClient().storage.from(BUCKET).remove(paths);
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  async function uploadFiles(files: File[]) {
    const accepted = files.filter((file) => ACCEPT.includes(file.type) && file.size <= MAX_BYTES);
    if (accepted.length < files.length) toast.error(t("rejected"));
    if (accepted.length === 0) return [];

    const supabase = createClient();
    setUploading(accepted.length);
    const urls: string[] = [];
    for (const file of accepted) {
      const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${businessId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        toast.error(t("uploadFailed"));
      } else {
        urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      setUploading((count) => Math.max(0, count - 1));
    }
    return urls;
  }

  async function addToGallery(fileList: FileList | null) {
    if (!fileList) return;
    // With no cover yet, the first photo takes that place.
    const limit = room + (cover ? 0 : 1);
    const files = Array.from(fileList).slice(0, Math.max(0, limit));
    if (fileList.length > files.length) toast.message(t("limit", { max: MAX_GALLERY }));
    const urls = await uploadFiles(files);
    if (urls.length === 0) return;
    if (cover) persist(cover, [...gallery, ...urls]);
    else persist(urls[0], [...gallery, ...urls.slice(1)]);
  }

  async function replaceCover(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const [url] = await uploadFiles([file]);
    if (!url) return;
    // The old cover is kept as a gallery photo while there is room for it.
    if (cover && gallery.length < MAX_GALLERY) persist(url, [cover, ...gallery]);
    else persist(url, gallery, cover ? [cover] : []);
  }

  function promote(url: string) {
    const rest = gallery.filter((item) => item !== url);
    persist(url, cover ? [cover, ...rest] : rest);
  }

  function remove(url: string) {
    if (url === cover) {
      const [next, ...rest] = gallery;
      persist(next ?? null, rest, [url]);
    } else {
      persist(
        cover,
        gallery.filter((item) => item !== url),
        [url],
      );
    }
  }

  return (
    <div className="space-y-5">
      <input
        ref={galleryInput}
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void addToGallery(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={coverInput}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void replaceCover(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="bg-muted/60 relative aspect-[16/9] overflow-hidden rounded-2xl border">
          {cover ? (
            <>
              <Image
                src={cover}
                alt={t("coverAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 40rem"
                className="object-cover"
              />
              <span className="bg-background/85 absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur">
                <Star className="fill-primary text-primary size-3.5" aria-hidden />
                {t("cover")}
              </span>
              <div className="absolute right-3 bottom-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full shadow-sm"
                  disabled={busy}
                  onClick={() => coverInput.current?.click()}
                >
                  <Upload className="size-4" aria-hidden />
                  {t("replaceCover")}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="rounded-full shadow-sm"
                  disabled={busy}
                  onClick={() => remove(cover)}
                  aria-label={t("remove")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => coverInput.current?.click()}
              className="glowa-focus hover:bg-muted text-muted-foreground flex size-full flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors"
            >
              <ImagePlus className="size-8" aria-hidden />
              <span className="text-foreground font-semibold">{t("addCover")}</span>
              <span className="text-xs">{t("coverHint")}</span>
            </button>
          )}
          {uploading > 0 ? (
            <div className="bg-background/70 absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium backdrop-blur-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("uploading", { count: uploading })}
            </div>
          ) : null}
        </div>

        <div className="bg-secondary/40 space-y-3 self-start rounded-2xl border p-5 text-sm">
          <p className="font-semibold">{t("tipsTitle")}</p>
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-4">
            <li>{t("tipLight")}</li>
            <li>{t("tipWork")}</li>
            <li>{t("tipSpace")}</li>
            <li>{t("tipFormat")}</li>
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            {t("gallery")}{" "}
            <span className="text-muted-foreground font-normal tabular-nums">
              {gallery.length}/{MAX_GALLERY}
            </span>
          </p>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {gallery.map((url, index) => (
            <li
              key={url}
              className="group bg-muted relative aspect-square overflow-hidden rounded-xl border"
            >
              <Image
                src={url}
                alt={t("photoAlt", { number: index + 1 })}
                fill
                sizes="(max-width: 640px) 33vw, 12rem"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => promote(url)}
                  className="glowa-focus bg-background/90 hover:bg-background inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.7rem] font-semibold shadow-sm backdrop-blur"
                >
                  <Star className="size-3" aria-hidden />
                  {t("makeCover")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(url)}
                  aria-label={t("remove")}
                  className="glowa-focus bg-background/90 hover:bg-background hover:text-destructive inline-flex size-7 items-center justify-center rounded-full shadow-sm backdrop-blur"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
          {room > 0 ? (
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => galleryInput.current?.click()}
                className={cn(
                  "glowa-focus text-muted-foreground hover:border-primary/50 hover:text-primary flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-medium transition-colors",
                  busy && "opacity-60",
                )}
              >
                {uploading > 0 ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="size-5" aria-hidden />
                )}
                {t("addPhotos")}
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
