import { notFound } from "next/navigation";

/**
 * Any path under a locale that no route claims. Without this, Next.js answers
 * with the root 404 (outside the locale layout), which has no translations,
 * header or theme. Throwing here hands the request to `[locale]/not-found`
 * instead, in the visitor's own language.
 */
export default function UnknownPath() {
  notFound();
}
