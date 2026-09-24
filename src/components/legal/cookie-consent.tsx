"use client";

import { Cookie } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { forgetReferral, rememberReferral } from "@/lib/actions/consent";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  GROWTH_CODE_PATTERN,
  OPEN_CONSENT_EVENT,
  parseConsent,
  serializeConsent,
} from "@/lib/consent";

function readConsent() {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match ? decodeURIComponent(match.split("=")[1] ?? "") : null);
}

function writeConsent(attribution: boolean) {
  const value = serializeConsent({ attribution, decidedAt: Date.now() / 1000 });
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

/** The `?ref=` a QR scan arrived with, if any; removed from the address bar. */
function takeReferralFromUrl() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("ref");
  if (!code) return null;
  url.searchParams.delete("ref");
  window.history.replaceState(window.history.state, "", url);
  return GROWTH_CODE_PATTERN.test(code) ? code : null;
}

/**
 * The cookie notice. Nothing optional is stored before a choice is made, so
 * the banner does not block the page; "accept" and "necessary only" carry
 * the same weight, as the EDPB's cookie banner guidance asks, and the choice
 * can be changed at any time from the footer.
 */
export function CookieConsent() {
  const t = useTranslations("consent");
  const [bannerOpen, setBannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [attribution, setAttribution] = useState(false);
  // Held until the visitor decides, so "accept" can still credit the scan.
  const [pendingRef, setPendingRef] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const consent = readConsent();
      const ref = takeReferralFromUrl();
      if (consent) {
        setAttribution(consent.attribution);
        if (consent.attribution && ref) void rememberReferral(ref);
      } else {
        setPendingRef(ref);
        setBannerOpen(true);
      }
    }, 0);

    function openSettings() {
      setAttribution(readConsent()?.attribution ?? false);
      setSettingsOpen(true);
    }
    window.addEventListener(OPEN_CONSENT_EVENT, openSettings);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(OPEN_CONSENT_EVENT, openSettings);
    };
  }, []);

  const decide = useCallback(
    (allowAttribution: boolean) => {
      writeConsent(allowAttribution);
      setAttribution(allowAttribution);
      setBannerOpen(false);
      setSettingsOpen(false);
      if (allowAttribution) {
        if (pendingRef) void rememberReferral(pendingRef);
      } else {
        void forgetReferral();
      }
      setPendingRef(null);
    },
    [pendingRef],
  );

  return (
    <>
      {bannerOpen ? (
        <section
          aria-label={t("title")}
          className="glowa-enter bg-card text-card-foreground border-border/80 fixed inset-x-3 bottom-3 z-50 rounded-2xl border p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md sm:p-5 print:hidden"
        >
          <div className="flex gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
              <Cookie className="size-4" aria-hidden />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-sm font-semibold">{t("title")}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("body")}{" "}
                <Link href="/legal/cookies" className="text-foreground underline underline-offset-2">
                  {t("policyLink")}
                </Link>
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => decide(false)}>
              {t("reject")}
            </Button>
            <Button variant="outline" onClick={() => decide(true)}>
              {t("accept")}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-muted-foreground hover:text-foreground glowa-focus mt-2 w-full rounded text-center text-xs underline-offset-2 hover:underline"
          >
            {t("settings")}
          </button>
        </section>
      ) : null}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("settingsTitle")}</DialogTitle>
            <DialogDescription>{t("settingsBody")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("necessaryTitle")}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("necessaryBody")}
                </p>
              </div>
              <Switch checked disabled aria-label={t("necessaryTitle")} />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div className="space-y-1">
                <Label htmlFor="consent-attribution" className="text-sm font-medium">
                  {t("attributionTitle")}
                </Label>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t("attributionBody")}
                </p>
              </div>
              <Switch
                id="consent-attribution"
                checked={attribution}
                onCheckedChange={setAttribution}
              />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">{t("noTracking")}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => decide(false)}>
              {t("reject")}
            </Button>
            <Button onClick={() => decide(attribution)}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A footer link that reopens the choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("consent");
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      {t("settings")}
    </button>
  );
}
