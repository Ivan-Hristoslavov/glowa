"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/push";

/** The VAPID public key arrives base64url; `subscribe` wants raw bytes. */
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

type State = "checking" | "unsupported" | "failed" | "denied" | "off" | "on";

/**
 * Turns web push on for this browser.
 *
 * Deliberately a button the person presses rather than a prompt on load.
 * A permission dialog that appears unasked is the fastest way to get
 * permanently blocked, and a blocked browser cannot be asked again.
 */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const t = useTranslations("settings.push");
  const [state, setState] = useState<State>("checking");
  // Bumped by the retry button. Depending on `state` instead would re-register
  // the worker on every toggle and loop.
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    // Every branch resolves asynchronously, including the unsupported one:
    // setting state synchronously inside an effect cascades renders.
    (async () => {
      const supported =
        Boolean(vapidPublicKey) &&
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      if (!supported) {
        if (active) setState("unsupported");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        const existing = await registration.pushManager.getSubscription();
        if (!active) return;

        if (Notification.permission === "denied") setState("denied");
        else setState(existing ? "on" : "off");
      } catch {
        // The browser can do push; registering the worker just did not work
        // this time. Telling someone their browser is unsupported when it is
        // not leaves them with nothing to try.
        if (active) setState("failed");
      }
    })();

    return () => {
      active = false;
    };
  }, [vapidPublicKey, attempt]);

  function enable() {
    if (!vapidPublicKey) return;

    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          // Required by every browser: a push must be shown to the user, so
          // there is no way to use this channel for silent tracking.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const json = subscription.toJSON();
        const result = await savePushSubscription({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent.slice(0, 400),
        });

        if (!result.ok) {
          await subscription.unsubscribe();
          toast.error(t(`errors.${result.code}`));
          return;
        }

        setState("on");
        toast.success(t("enabled"));
      } catch {
        toast.error(t("errors.generic"));
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setState("off");
        toast.success(t("disabled"));
      } catch {
        toast.error(t("errors.generic"));
      }
    });
  }

  if (state === "checking") {
    return <div className="h-9" aria-hidden />;
  }

  if (state === "unsupported") {
    return <p className="text-muted-foreground text-sm">{t("unsupported")}</p>;
  }

  if (state === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState("checking");
            setAttempt((value) => value + 1);
          }}
        >
          {t("retry")}
        </Button>
        <p className="text-muted-foreground text-xs">{t("failed")}</p>
      </div>
    );
  }

  if (state === "denied") {
    // Nothing this button can do now; the browser has to be changed first.
    return <p className="text-muted-foreground text-sm">{t("blocked")}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={state === "on" ? "outline" : "default"}
        size="sm"
        disabled={pending}
        onClick={state === "on" ? disable : enable}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : state === "on" ? (
          <BellOff className="size-4" aria-hidden />
        ) : (
          <BellRing className="size-4" aria-hidden />
        )}
        {state === "on" ? t("turnOff") : t("turnOn")}
      </Button>
      <p className="text-muted-foreground text-xs">
        {state === "on" ? t("onNote") : t("offNote")}
      </p>
    </div>
  );
}
