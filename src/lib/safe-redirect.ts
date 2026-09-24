/**
 * The only way a `?next=` value becomes a redirect target.
 *
 * "Starts with / and not with //" was the rule in three places, and it let
 * `/\evil.example` through: browsers read a backslash in a URL as a slash, so
 * the Location header `/\evil.example` sends the visitor to another origin -
 * right after they typed their password, which is exactly where a phishing
 * page wants them. The check now resolves the path the way a browser would and
 * keeps it only if it is still on our origin.
 */
const BASE = "https://glowa.invalid";

export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  // Backslashes and control characters have no business in our own paths, and
  // both are ways to smuggle a second slash past a naive prefix check.
  if (value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;

  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
