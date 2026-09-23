"use client";

import { Check, Copy, Download, QrCode, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import { deleteGrowthLink, setGrowthLinkActive } from "@/lib/actions/growth";

export type GrowthLinkView = {
  id: string;
  code: string;
  kind: string;
  label: string;
  target: string;
  isActive: boolean;
  visitCount: number;
  bookingCount: number;
  serviceName: string | null;
  referrerName: string | null;
  url: string;
  /** Pre-rendered on the server: the encoder has no business in the bundle. */
  qrSvg: string;
};

export function GrowthLinkCard({
  businessId,
  link,
  editable,
}: {
  businessId: string;
  link: GrowthLinkView;
  editable: boolean;
}) {
  const t = useTranslations("admin.growth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("errors.copy"));
    }
  }

  function downloadQr() {
    // A Blob rather than a data: URI - the SVG contains a URL with characters
    // that would have to be escaped, and this keeps the filename meaningful.
    const blob = new Blob([link.qrSvg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `glowa-${link.code}.svg`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function toggle(isActive: boolean) {
    startTransition(async () => {
      const result = await setGrowthLinkActive({
        businessId,
        linkId: link.id,
        isActive,
      });
      if (!result.ok) toast.error(t(`errors.${result.code}`));
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteGrowthLink(businessId, link.id);
      if (!result.ok) {
        toast.error(t(`errors.${result.code}`));
        return;
      }
      toast.success(t("deleted"));
      router.refresh();
    });
  }

  // Visits are raw scans, not people: the same poster scanned twice counts
  // twice. Saying so beats implying a precision the data does not have.
  const conversion =
    link.visitCount > 0
      ? Math.round((link.bookingCount / link.visitCount) * 100)
      : null;

  return (
    <div className="glowa-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading truncate text-lg">{link.label}</h3>
            <Badge variant={link.kind === "referral" ? "secondary" : "outline"}>
              {t(`kind.${link.kind}`)}
            </Badge>
            {link.isActive ? null : (
              <Badge variant="outline" className="text-muted-foreground">
                {t("inactive")}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {link.referrerName
              ? t("byReferrer", { name: link.referrerName })
              : link.serviceName
                ? t("forService", { service: link.serviceName })
                : t(`target.${link.target}`)}
          </p>
        </div>

        {editable ? (
          <div className="flex items-center gap-2">
            <Switch
              checked={link.isActive}
              onCheckedChange={toggle}
              disabled={pending}
              aria-label={t("toggleActive")}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={pending}
              aria-label={t("delete")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-xs">{link.url}</code>
        <Button variant="ghost" size="icon" onClick={copy} aria-label={t("copy")}>
          {copied ? (
            <Check className="text-success size-4" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-muted-foreground text-xs">{t("visits")}</dt>
          <dd className="font-heading text-2xl">{link.visitCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{t("bookings")}</dt>
          <dd className="font-heading text-2xl">{link.bookingCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{t("conversion")}</dt>
          <dd className="font-heading text-2xl">
            {conversion === null ? "—" : `${conversion}%`}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowQr((value) => !value)}
        >
          <QrCode className="size-4" />
          {showQr ? t("hideQr") : t("showQr")}
        </Button>
        <Button variant="outline" size="sm" onClick={downloadQr}>
          <Download className="size-4" />
          {t("downloadQr")}
        </Button>
      </div>

      {showQr ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
          <div
            // The encoder writes its own width/height on the <svg>, so the
            // child selector is what actually constrains it to the box.
            className="size-44 [&>svg]:size-full"
            // Server-rendered by the `qrcode` encoder from the link URL; no
            // user-authored content reaches this markup.
            dangerouslySetInnerHTML={{ __html: link.qrSvg }}
          />
          <p className="font-mono text-xs text-black">{link.code}</p>
        </div>
      ) : null}
    </div>
  );
}
