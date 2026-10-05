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
        // One slim strip along the bottom edge. The first version was a card
        // 250px tall in the corner: on a 1366x768 laptop it sat on top of the
        // hero search's submit button, and on a phone it took a third of the
        // first screen - the very first thing a new visitor met was a wall of
        // text over the thing they came to do.
        <section
          aria-label={t("title")}
          className="glowa-enter bg-card/95 text-card-foreground border-border/80 fixed inset-x-2 bottom-2 z-50 rounded-2xl border p-3 shadow-xl backdrop-blur sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-3xl sm:p-3.5 print:hidden"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="bg-primary/10 text-primary hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
                <Cookie className="size-4" aria-hidden />
              </span>
              <p className="text-muted-foreground text-[0.8125rem] leading-snug">
                <strong className="text-foreground font-semibold">{t("title")}.</strong>{" "}
                {t("body")}{" "}
                <Link href="/legal/cookies" className="text-foreground underline underline-offset-2">
                  {t("policyLink")}
                </Link>
                {" · "}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-foreground glowa-focus rounded underline underline-offset-2"
                >
                  {t("settingsShort")}
                </button>
              </p>
            </div>
            {/* Equal weight on purpose: declining must be as easy as accepting. */}
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" className="h-10 sm:px-4" onClick={() => decide(false)}>
                {t("reject")}
              </Button>
              <Button variant="outline" className="h-10 sm:px-4" onClick={() => decide(true)}>
                {t("accept")}
              </Button>
            </div>
          </div>
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
