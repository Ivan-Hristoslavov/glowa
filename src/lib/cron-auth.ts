import "server-only";

/**
 * Scheduled endpoints are public in the routing sense, so the bearer secret is
 * the whole authorization. Returns the response to send when the caller is not
 * allowed in, or `null` when it is.
 */
export function refuseUnlessCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const provided = request.headers.get("authorization");
  if (!provided || !timingSafeEqual(provided, `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

/** Constant-time compare, so a wrong secret leaks nothing through timing. */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
