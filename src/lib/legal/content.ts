import "server-only";

import type { Locale } from "@/i18n/routing";
import type { LegalDoc } from "@/lib/legal/entity";

export type LegalSection = {
  id: string;
  heading: string;
  body: string[];
  list?: string[];
};

export type LegalDocument = {
  title: string;
  description: string;
  intro: string[];
  sections: LegalSection[];
};

export type LegalContent = {
  meta: Record<"updated" | "toc" | "pending" | "contactCta" | "otherDocs" | "backToTop", string>;
  docs: Record<LegalDoc, LegalDocument>;
};

/**
 * Legal texts live in `messages/legal/{locale}.json`, apart from the UI
 * messages: those are sent to the browser on every page, and four long
 * documents have no business in every page's payload. Loaded on the server
 * for the legal pages only.
 */
export async function loadLegalContent(locale: Locale): Promise<LegalContent> {
  return (await import(`../../../messages/legal/${locale}.json`)).default as LegalContent;
}
