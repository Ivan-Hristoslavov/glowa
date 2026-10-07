"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Google's "G", in its own colours, as Google's branding guidance asks. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

type OAuthProvider = "google" | "apple";

/**
 * One "Continue with ..." button. Starts a PKCE flow in the browser; the
 * provider returns to /auth/callback, which sets the session and sends the
 * person on to `next` - the booking they were in the middle of, or their
 * profile. Apple has no account picker to ask for, so only Google gets
 * `prompt=select_account`.
 */
function ProviderButton({
  provider,
  nextPath,
  mark,
  label,
}: {
  provider: OAuthProvider;
  nextPath?: string;
  mark: React.ReactNode;
  label: string;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setPending(true);
    setFailed(false);
    const next = nextPath ?? `/${locale}/profile`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
      },
    });
    // On success the browser is already leaving the page.
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full gap-2.5"
        onClick={start}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : mark}
        {label}
      </Button>
      {failed ? (
        <p role="alert" className="text-destructive text-center text-xs">
          {t("errors.oauth")}
        </p>
      ) : null}
    </div>
  );
}

export function GoogleButton({ nextPath }: { nextPath?: string }) {
  const t = useTranslations("auth");
  return (
    <ProviderButton provider="google" nextPath={nextPath} mark={<GoogleMark />} label={t("continueWithGoogle")} />
  );
}

export function AppleButton({ nextPath }: { nextPath?: string }) {
  const t = useTranslations("auth");
  return (
    <ProviderButton provider="apple" nextPath={nextPath} mark={<AppleMark />} label={t("continueWithApple")} />
  );
}

/** Apple's mark, in the current text colour so it follows light and dark. */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M16.37 12.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.1 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71s1.7.71 2.87.69c1.19-.02 1.94-1.08 2.66-2.15.84-1.23 1.19-2.42 1.2-2.48-.03-.01-2.3-.88-2.28-3.54zM14.2 6.1c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z" />
    </svg>
  );
}

/** "or", between the provider buttons and the email form. */
export function AuthDivider() {
  const t = useTranslations("auth");
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
      <span className="bg-border h-px flex-1" />
      {t("or")}
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
