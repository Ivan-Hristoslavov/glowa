/**
 * Cookie consent, shared by the server (the /go route, the referral action)
 * and the browser (the banner).
 *
 * GLOWA sets only one cookie that is not strictly necessary: `glowa_ref`,
 * which credits a booking to the QR code or referral link it came from. That
 * is the only optional category. There are no analytics or advertising
 * cookies to consent to, and the banner says so rather than inventing
 * categories.
 *
 * The choice itself is stored in `glowa_consent` as `version.attribution.
 * timestamp` - e.g. `1.0.1758700000` - which is strictly necessary (it is the
 * record of the choice) and readable on both sides. Bumping the version asks
 * everyone again, which is what a change in what we store requires.
 */
export const CONSENT_COOKIE = "glowa_consent";
export const CONSENT_VERSION = 1;
/** Six months, then ask again. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182;
/** Fired on `window` to reopen the consent settings from anywhere. */
export const OPEN_CONSENT_EVENT = "glowa:cookie-settings";
/** Growth link codes, as the database constrains them. */
export const GROWTH_CODE_PATTERN = /^[a-z0-9]{6,16}$/;

export type Consent = {
  attribution: boolean;
  /** Seconds since the epoch, when the choice was made. */
  decidedAt: number;
};

export function parseConsent(value: string | undefined | null): Consent | null {
  if (!value) return null;
  const [version, attribution, decidedAt] = value.split(".");
  if (Number(version) !== CONSENT_VERSION) return null;
  const at = Number(decidedAt);
  if (!Number.isFinite(at)) return null;
  return { attribution: attribution === "1", decidedAt: at };
}

export function serializeConsent(consent: Consent) {
  return `${CONSENT_VERSION}.${consent.attribution ? 1 : 0}.${Math.floor(consent.decidedAt)}`;
}
