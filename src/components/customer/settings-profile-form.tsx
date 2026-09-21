"use client";

import { Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { updateProfile } from "@/lib/actions/settings";
import { resolveViewerTimeZone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** A short, honest list beats 400 IANA zones in a dropdown. */
const COMMON_ZONES = [
  "Europe/Sofia",
  "Europe/Bucharest",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Budapest",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Istanbul",
  "UTC",
];

type ProfileSettingsFormProps = {
  userId: string;
  email: string | null;
  initial: {
    fullName: string;
    phone: string;
    locale: Locale;
    timezone: string;
    avatarUrl: string | null;
  };
};

export function ProfileSettingsForm({
  userId,
  email,
  initial,
}: ProfileSettingsFormProps) {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const auth = useTranslations("auth");
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const detected = resolveViewerTimeZone();
  const zones = [
    ...new Set(
      [...COMMON_ZONES, timezone, detected].filter(
        (zone): zone is string => typeof zone === "string" && zone.length > 0,
      ),
    ),
  ].sort();

  async function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t("avatarHint"));
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // Storage RLS requires the first path segment to be the caller's id.
      const path = `${userId}/avatar-${Date.now()}.${extension}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      setAvatarUrl(publicUrl);
      const result = await updateProfile({
        fullName,
        phone,
        locale,
        timezone,
        avatarUrl: publicUrl,
      });
      if (!result.ok) throw new Error(result.error);

      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(auth("errors.generic"));
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({ fullName, phone, locale, timezone });
      if (!result.ok) {
        toast.error(auth("errors.generic"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-lg">
            {(fullName || email || "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={onAvatarChange}
            className="sr-only"
            id="avatar-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInput.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {isUploading ? t("uploading") : t("upload")}
          </Button>
          <p className="text-muted-foreground text-xs">{t("avatarHint")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full-name">{t("fullName")}</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            minLength={2}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="locale">{t("locale")}</Label>
          <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
            <SelectTrigger id="locale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routing.locales.map((value) => (
                <SelectItem key={value} value={value}>
                  {localeLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">{t("timezone")}</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isPending ? common("saving") : common("save")}
      </Button>
    </form>
  );
}
