import "server-only";

import { clientIp } from "@/lib/rate-limit";

/**
 * Cloudflare Turnstile, when it is configured. Without `TURNSTILE_SECRET_KEY`
 * every request passes (local development, and a deployment that has not set it
 * up yet); with it, a form that carries no valid token is refused. The widget
 * renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, so the two are
 * switched on together in the host's environment.
 */
export async function passesCaptcha(formData: FormData): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  const token = formData.get("cf-turnstile-response");
  if (typeof token !== "string" || token.length === 0) return false;

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: await clientIp() }),
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (cause) {
    // Cloudflare unreachable: do not lock people out of their own account.
    console.error("[turnstile] verification unavailable", cause);
    return true;
  }
}
