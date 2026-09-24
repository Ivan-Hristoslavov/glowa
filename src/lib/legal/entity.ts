/**
 * The operator of Glowa, as the law requires it to be published (Bulgarian
 * E-Commerce Act art. 4, GDPR art. 13). Public information, not secrets.
 *
 * Deliberately empty until the company exists: the legal pages show "to be
 * completed before launch" for a null field rather than a made-up name or
 * number. Fill these in before going live - see PROJECT_CONTEXT §11.
 */
export const LEGAL_ENTITY = {
  company: null as string | null,
  companyId: null as string | null,
  vatId: null as string | null,
  address: null as string | null,
  email: "hello@glowa.bg",
};

/** When the current texts took effect; change it with any material edit. */
export const LEGAL_EFFECTIVE_DATE = "2026-09-24";

export const LEGAL_DOCS = ["privacy", "terms", "cookies", "imprint"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
