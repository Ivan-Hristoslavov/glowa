"use client";

import { Check, Loader2, Printer, QrCode, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { createGrowthLink } from "@/lib/actions/growth";
import { cn } from "@/lib/utils";

export type FlyerLinkOption = {
  id: string;
  label: string | null;
  url: string;
  tracked: boolean;
  qrSvg: string;
};

type FlyerStudioProps = {
  businessId: string;
  canCreateLink: boolean;
  business: {
    name: string;
    logoUrl: string | null;
    coverUrl: string | null;
    phone: string | null;
    address: string | null;
  };
  links: FlyerLinkOption[];
};

type Template = "editorial" | "bold" | "minimal";
type Size = "A5" | "A4";

const ACCENTS = [
  { id: "coral", value: "#d96c61" },
  { id: "ink", value: "#0f1212" },
  { id: "sage", value: "#6f8f78" },
  { id: "plum", value: "#6e3b5b" },
  { id: "gold", value: "#b0823f" },
] as const;

/**
 * Makes a print-ready flyer in the browser.
 *
 * The flyer is laid out in container-query units (`cqw`), so the same markup
 * is the on-screen preview at any width and the printed page at A5 or A4 -
 * nothing is rasterised, and text and the QR stay sharp at any size. Printing
 * hides everything else on the page (see `@media print` in globals.css);
 * "save as PDF" in the print dialog gives a file for a print shop.
 */
export function FlyerStudio({ businessId, canCreateLink, business, links }: FlyerStudioProps) {
  const t = useTranslations("admin.flyer");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [template, setTemplate] = useState<Template>("editorial");
  const [size, setSize] = useState<Size>("A5");
  const [accent, setAccent] = useState<string>(ACCENTS[0].value);
  const [headline, setHeadline] = useState(t("defaults.headline"));
  const [subline, setSubline] = useState(t("defaults.subline"));
  const [offer, setOffer] = useState("");
  const [showContacts, setShowContacts] = useState(true);
  const [linkId, setLinkId] = useState(links[0]?.id ?? "direct");

  const link = links.find((option) => option.id === linkId) ?? links[links.length - 1];
  const hasTracked = links.some((option) => option.tracked);
  const displayUrl = link.url.replace(/^https?:\/\//, "");
  const contacts = [business.address, business.phone].filter(Boolean).join(" · ");

  function createTrackedLink() {
    startTransition(async () => {
      const result = await createGrowthLink({
        businessId,
        kind: "qr",
        label: t("trackedLabel"),
        target: "business",
        serviceId: null,
        referrerClientId: null,
      });
      if (!result.ok) {
        toast.error(t("linkFailed"));
        return;
      }
      toast.success(t("linkCreated"));
      if (result.id) setLinkId(result.id);
      router.refresh();
    });
  }

  const qr = (
    <div
      className="aspect-square w-full bg-white [&_svg]:block [&_svg]:size-full"
      // Server-rendered by the `qrcode` package from our own URL.
      dangerouslySetInnerHTML={{ __html: link.qrSvg }}
    />
  );

  const logo = business.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- printed at any size; next/image would fix a raster width.
    <img src={business.logoUrl} alt="" className="size-full object-cover" />
  ) : (
    <span className="font-heading" style={{ fontSize: "7cqw", color: accent }}>
      {business.name.charAt(0)}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* The page size follows the choice, so the print dialog opens at it. */}
      <style>{`@media print { @page { size: ${size} portrait; margin: 0; } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("subtitle")}</p>
        </div>
        <Button size="lg" onClick={() => window.print()} className="shadow-primary/25 shadow-lg">
          <Printer className="size-4" aria-hidden />
          {t("print")}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] print:block">
        {/* ---------------------------------------------------------- controls */}
        <div className="glowa-card h-fit space-y-5 rounded-3xl p-5 print:hidden lg:sticky lg:top-44">
          <div className="space-y-2">
            <Label>{t("template")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["editorial", "bold", "minimal"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={template === option}
                  onClick={() => setTemplate(option)}
                  className={cn(
                    "glowa-focus rounded-xl border px-2 py-2.5 text-xs font-medium transition-all",
                    template === option
                      ? "border-primary bg-accent text-foreground"
                      : "hover:border-primary/40 text-muted-foreground",
                  )}
                >
                  {t(`templates.${option}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("accent")}</Label>
            <div className="flex gap-2">
              {ACCENTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccent(option.value)}
                  aria-label={t(`accents.${option.id}`)}
                  aria-pressed={accent === option.value}
                  className="glowa-focus relative size-9 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10 transition-transform hover:scale-110"
                  style={{ background: option.value }}
                >
                  {accent === option.value ? (
                    <Check className="absolute inset-0 m-auto size-4 text-white" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flyer-headline">{t("headline")}</Label>
            <Input
              id="flyer-headline"
              value={headline}
              maxLength={60}
              onChange={(event) => setHeadline(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flyer-subline">{t("subline")}</Label>
            <Textarea
              id="flyer-subline"
              value={subline}
              rows={3}
              maxLength={160}
              onChange={(event) => setSubline(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flyer-offer">{t("offer")}</Label>
            <Input
              id="flyer-offer"
              value={offer}
              maxLength={40}
              placeholder={t("offerPlaceholder")}
              onChange={(event) => setOffer(event.target.value)}
            />
          </div>

          <label className="flex items-center justify-between gap-3 text-sm">
            {t("showContacts")}
            <Switch checked={showContacts} onCheckedChange={setShowContacts} />
          </label>

          <div className="space-y-1.5">
            <Label>{t("link")}</Label>
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {links.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.tracked ? `${option.label} · ${t("tracked")}` : t("direct")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hasTracked && canCreateLink ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={createTrackedLink}
                disabled={isPending}
                className="mt-1 w-full"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <QrCode className="size-3.5" aria-hidden />
                )}
                {t("createTracked")}
              </Button>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {link.tracked ? t("trackedHint") : t("directHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t("size")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["A5", "A4"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={size === option}
                  onClick={() => setSize(option)}
                  className={cn(
                    "glowa-focus rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                    size === option ? "border-primary bg-accent" : "hover:border-primary/40",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{t("printHint")}</p>
          </div>
        </div>

        {/* ----------------------------------------------------------- preview */}
        <div className="bg-muted/60 flex items-start justify-center rounded-3xl p-4 sm:p-8 print:block print:bg-transparent print:p-0">
          <article
            id="glowa-flyer"
            className="relative w-full max-w-[34rem] overflow-hidden bg-white text-[#0f1212] shadow-[var(--shadow-pop)] [container-type:inline-size] print:max-w-none print:shadow-none"
            style={{ aspectRatio: "148 / 210", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
          >
            {template === "editorial" ? (
              <div className="flex h-full flex-col" style={{ background: "#f8f3ee" }}>
                <div className="relative h-[44%] shrink-0 overflow-hidden" style={{ background: accent }}>
                  {business.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- see the logo above.
                    <img src={business.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div
                      className="size-full"
                      style={{ background: `linear-gradient(135deg, ${accent}, #eac2bb)` }}
                    />
                  )}
                  {offer ? <OfferSticker text={offer} accent={accent} /> : null}
                </div>
                <div className="relative flex flex-1 flex-col px-[8cqw] pb-[6cqw]">
                  <div
                    className="-mt-[9cqw] flex size-[18cqw] items-center justify-center overflow-hidden rounded-full border-[1cqw] border-[#f8f3ee] bg-white"
                  >
                    {logo}
                  </div>
                  <p
                    className="mt-[3cqw] font-semibold tracking-[0.2em] uppercase"
                    style={{ fontSize: "2.4cqw", color: accent }}
                  >
                    {business.name}
                  </p>
                  <h2 className="font-heading mt-[2cqw] leading-[1.05]" style={{ fontSize: "8.6cqw" }}>
                    {headline}
                  </h2>
                  <p className="mt-[3cqw] leading-snug text-[#4a4541]" style={{ fontSize: "3.3cqw" }}>
                    {subline}
                  </p>
                  <div className="mt-auto flex items-end gap-[5cqw]">
                    <div className="w-[30cqw] shrink-0 rounded-[3cqw] bg-white p-[2cqw] shadow-[0_1cqw_4cqw_-1cqw_rgba(0,0,0,0.18)]">
                      {qr}
                    </div>
                    <div className="pb-[1cqw]">
                      <p className="font-semibold" style={{ fontSize: "4cqw", color: accent }}>
                        {t("scan")}
                      </p>
                      <p className="mt-[1cqw] text-[#6b625b]" style={{ fontSize: "2.4cqw" }}>
                        {displayUrl}
                      </p>
                      {showContacts && contacts ? (
                        <p className="mt-[2cqw] text-[#4a4541]" style={{ fontSize: "2.5cqw" }}>
                          {contacts}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {template === "bold" ? (
              <div
                className="relative flex h-full flex-col items-center px-[9cqw] py-[9cqw] text-center text-white"
                style={{ background: accent }}
              >
                <div
                  aria-hidden
                  className="absolute -top-[20cqw] -right-[20cqw] size-[70cqw] rounded-full bg-white/10"
                />
                <div
                  aria-hidden
                  className="absolute -bottom-[25cqw] -left-[15cqw] size-[60cqw] rounded-full bg-black/10"
                />
                <div className="relative flex size-[16cqw] items-center justify-center overflow-hidden rounded-full bg-white">
                  {logo}
                </div>
                <p className="relative mt-[3cqw] font-semibold tracking-[0.22em] uppercase" style={{ fontSize: "2.5cqw" }}>
                  {business.name}
                </p>
                <h2 className="font-heading relative mt-[4cqw] leading-[1.02]" style={{ fontSize: "10cqw" }}>
                  {headline}
                </h2>
                <p className="relative mt-[3cqw] leading-snug text-white/85" style={{ fontSize: "3.4cqw" }}>
                  {subline}
                </p>
                {offer ? (
                  <p
                    className="relative mt-[4cqw] rounded-full bg-white px-[4cqw] py-[1.5cqw] font-bold"
                    style={{ fontSize: "3.4cqw", color: accent }}
                  >
                    {offer}
                  </p>
                ) : null}
                <div className="relative mt-auto w-[40cqw] rounded-[4cqw] bg-white p-[2.5cqw]">{qr}</div>
                <p className="relative mt-[2.5cqw] font-semibold" style={{ fontSize: "3.6cqw" }}>
                  {t("scan")}
                </p>
                {showContacts && contacts ? (
                  <p className="relative mt-[1cqw] text-white/80" style={{ fontSize: "2.4cqw" }}>
                    {contacts}
                  </p>
                ) : null}
              </div>
            ) : null}

            {template === "minimal" ? (
              <div className="flex h-full flex-col px-[9cqw] py-[9cqw]">
                <div className="flex items-center gap-[3cqw]">
                  <div
                    className="flex size-[11cqw] items-center justify-center overflow-hidden rounded-full"
                    style={{ boxShadow: `0 0 0 0.5cqw ${accent}` }}
                  >
                    {logo}
                  </div>
                  <p className="font-semibold" style={{ fontSize: "3.4cqw" }}>
                    {business.name}
                  </p>
                </div>
                <div className="mt-[14cqw] h-[1cqw] w-[14cqw]" style={{ background: accent }} />
                <h2 className="font-heading mt-[5cqw] leading-[1.02]" style={{ fontSize: "11.5cqw" }}>
                  {headline}
                </h2>
                <p className="mt-[4cqw] max-w-[80%] leading-snug text-[#4a4541]" style={{ fontSize: "3.6cqw" }}>
                  {subline}
                </p>
                {offer ? (
                  <p className="mt-[4cqw] inline-flex items-center gap-[1.5cqw] font-semibold" style={{ fontSize: "3.6cqw", color: accent }}>
                    <Sparkles style={{ width: "4cqw", height: "4cqw" }} aria-hidden />
                    {offer}
                  </p>
                ) : null}
                <div className="mt-auto flex items-end justify-between gap-[5cqw] border-t pt-[5cqw]" style={{ borderColor: "#ddd5ce" }}>
                  <div>
                    <p className="font-semibold" style={{ fontSize: "3.8cqw" }}>
                      {t("scan")}
                    </p>
                    <p className="mt-[1cqw] text-[#6b625b]" style={{ fontSize: "2.4cqw" }}>
                      {displayUrl}
                    </p>
                    {showContacts && contacts ? (
                      <p className="mt-[2cqw] text-[#4a4541]" style={{ fontSize: "2.5cqw" }}>
                        {contacts}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-[30cqw] shrink-0">{qr}</div>
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </div>
  );
}

/** A round "sticker" for the offer, slightly turned, as printed ones are. */
function OfferSticker({ text, accent }: { text: string; accent: string }) {
  return (
    <div
      className="absolute top-[6cqw] right-[6cqw] flex size-[24cqw] rotate-[8deg] items-center justify-center rounded-full bg-white p-[2.5cqw] text-center leading-tight font-bold shadow-[0_1cqw_4cqw_-1cqw_rgba(0,0,0,0.3)]"
      style={{ color: accent, fontSize: "3.4cqw" }}
    >
      {text}
    </div>
  );
}
