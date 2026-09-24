"use client";

import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { updateBusinessImages } from "@/lib/actions/business";
import { prepareImage } from "@/lib/media/prepare-image";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_GALLERY = 12;

type BusinessMediaFormProps = {
  businessId: string;
  businessName: string;
  initial: { logoUrl: string | null; coverUrl: string | null; gallery: string[] };
  /**
   * Only the logo. Settings uses this beside the photo manager, which owns
   * the cover and the gallery; saving the logo alone never touches them.
   */
  logoOnly?: boolean;
};

type Kind = "logo" | "cover" | "gallery";

/**
 * Logo, cover and gallery - the three things that make a salon page look like
 * that salon rather than a template. Files go straight from the browser to
 * the `business-media` bucket (its policies only accept this business's own
 * folder, and only from a manager); the server action then accepts only URLs
 * from that folder.
 */
export function BusinessMediaForm({
  businessId,
  businessName,
  initial,
  logoOnly = false,
}: BusinessMediaFormProps) {
  const t = useTranslations("admin.media");
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [gallery, setGallery] = useState(initial.gallery);
  const [busy, setBusy] = useState<Kind | null>(null);

  async function upload(kind: Kind, file: File) {
    const maxSide = kind === "logo" ? 512 : kind === "cover" ? 2000 : 1600;
    const blob = await prepareImage(file, maxSide);
    const extension = blob.type === "image/webp" ? "webp" : (file.name.split(".").pop() ?? "jpg");
    // Storage RLS keys on the first path segment being this business's id.
    const path = `${businessId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension.toLowerCase()}`;

    const supabase = createClient();
    const { error } = await supabase.storage
      .from("business-media")
      .upload(path, blob, { contentType: blob.type || file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from("business-media").getPublicUrl(path).data.publicUrl;
  }

  async function save(patch: Parameters<typeof updateBusinessImages>[0]) {
    const result = await updateBusinessImages(patch);
    if (!result.ok) throw new Error(result.code);
    router.refresh();
  }

  async function handleFiles(kind: Kind, files: FileList | File[]) {
    const list = Array.from(files).filter((file) => ACCEPT.split(",").includes(file.type));
    if (list.length === 0) {
      toast.error(t("wrongType"));
      return;
    }
    if (list.some((file) => file.size > 15 * 1024 * 1024)) {
      toast.error(t("tooLarge"));
      return;
    }

    setBusy(kind);
    try {
      if (kind === "gallery") {
        const room = MAX_GALLERY - gallery.length;
        if (room <= 0) {
          toast.error(t("galleryFull", { max: MAX_GALLERY }));
          return;
        }
        const urls: string[] = [];
        for (const file of list.slice(0, room)) urls.push(await upload(kind, file));
        const next = [...gallery, ...urls];
        await save({ businessId, gallery: next });
        setGallery(next);
      } else {
        const url = await upload(kind, list[0]);
        await save(kind === "logo" ? { businessId, logoUrl: url } : { businessId, coverUrl: url });
        if (kind === "logo") setLogoUrl(url);
        else setCoverUrl(url);
      }
      toast.success(t("saved"));
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: Kind, url?: string) {
    setBusy(kind);
    try {
      if (kind === "gallery") {
        const next = gallery.filter((entry) => entry !== url);
        await save({ businessId, gallery: next });
        setGallery(next);
      } else if (kind === "logo") {
        await save({ businessId, logoUrl: null });
        setLogoUrl(null);
      } else {
        await save({ businessId, coverUrl: null });
        setCoverUrl(null);
      }
      toast.success(t("saved"));
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Cover with the logo overlapping it - exactly how the public page
          composes them, so what the owner sees here is what customers get. */}
      <div>
        {!logoOnly ? (
        <DropZone
          label={t("cover")}
          hint={t("coverHint")}
          busy={busy === "cover"}
          onFiles={(files) => handleFiles("cover", files)}
          className="aspect-[16/6] rounded-3xl"
          filled={Boolean(coverUrl)}
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover"
            />
          ) : null}
        </DropZone>
        ) : null}

        <div className={cn("relative flex items-end gap-4", !logoOnly && "-mt-12 ml-6")}>
          <DropZone
            label={t("logo")}
            hint={t("logoHint")}
            busy={busy === "logo"}
            onFiles={(files) => handleFiles("logo", files)}
            className="border-background size-24 rounded-full border-4"
            compact
            filled={Boolean(logoUrl)}
          >
            {logoUrl ? (
              <Image src={logoUrl} alt="" fill sizes="96px" className="object-cover" />
            ) : (
              <span className="font-heading text-primary text-3xl">{businessName.charAt(0)}</span>
            )}
          </DropZone>
          <div className="flex flex-wrap gap-2 pb-1">
            {coverUrl && !logoOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove("cover")}
                disabled={busy !== null}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("removeCover")}
              </Button>
            ) : null}
            {logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove("logo")}
                disabled={busy !== null}
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t("removeLogo")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {!logoOnly ? (
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-medium">{t("gallery")}</h3>
            <p className="text-muted-foreground text-sm">
              {t("galleryHint", { count: gallery.length, max: MAX_GALLERY })}
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {gallery.map((url) => (
            <li
              key={url}
              className="group bg-secondary relative aspect-square overflow-hidden rounded-2xl"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => remove("gallery", url)}
                disabled={busy !== null}
                aria-label={t("removePhoto")}
                className="glowa-focus absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
          {gallery.length < MAX_GALLERY ? (
            <li>
              <DropZone
                label={t("addPhotos")}
                hint={t("addPhotosHint")}
                busy={busy === "gallery"}
                onFiles={(files) => handleFiles("gallery", files)}
                className="aspect-square rounded-2xl"
                multiple
              />
            </li>
          ) : null}
        </ul>
      </div>
      ) : null}
    </div>
  );
}

function DropZone({
  label,
  hint,
  busy,
  onFiles,
  className,
  children,
  compact,
  filled,
  multiple,
}: {
  label: string;
  hint: string;
  busy: boolean;
  onFiles: (files: FileList) => void;
  className?: string;
  children?: React.ReactNode;
  compact?: boolean;
  filled?: boolean;
  multiple?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      className={cn(
        "group bg-secondary relative flex items-center justify-center overflow-hidden border-2 border-dashed transition-colors",
        filled ? "border-transparent" : "border-border hover:border-primary/60",
        over && "border-primary bg-accent",
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files);
      }}
    >
      {children}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn(
          "glowa-focus absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center transition-all",
          filled
            ? "bg-black/0 text-transparent hover:bg-black/45 hover:text-white focus-visible:bg-black/45 focus-visible:text-white"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin text-current" aria-hidden />
        ) : filled ? (
          <UploadCloud className="size-6" aria-hidden />
        ) : (
          <ImagePlus className="size-6" aria-hidden />
        )}
        {!compact ? (
          <span className="text-sm font-medium">{label}</span>
        ) : (
          <span className="sr-only">{label}</span>
        )}
        {!compact && !filled ? <span className="text-xs opacity-80">{hint}</span> : null}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
