/**
 * The referral cookie. It holds a growth link code and nothing else, so the
 * booking that may follow a QR scan can be credited to the right poster.
 * Thirty days is long enough for "I'll book later tonight" and short enough
 * not to be a tracker. Optional: set only with consent (lib/consent.ts).
 */
export const GROWTH_COOKIE = "glowa_ref";
export const GROWTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
