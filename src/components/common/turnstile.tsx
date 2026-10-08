"use client";

import Script from "next/script";

/**
 * The Turnstile challenge, drawn only when a site key is configured. It adds a
 * hidden `cf-turnstile-response` field to the form it sits in; the server
 * action checks it with `passesCaptcha`.
 */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
    </>
  );
}
