import "server-only";

import QRCode from "qrcode";

/**
 * A QR that is going to be printed, so it is drawn as SVG paths rather than a
 * raster: a poster, a card and a mirror sticker are all different sizes, and a
 * PNG only looks right at one of them.
 *
 * Error correction is set to Q (25%). A code in a salon gets steam on it,
 * fingerprints, and a logo punched into the middle; M is the usual default and
 * is not enough for any of that.
 */
export async function renderQrSvg(
  value: string,
  options: { size?: number; margin?: number } = {},
) {
  return QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: options.margin ?? 2,
    width: options.size ?? 512,
    color: {
      // Ink on white. A tinted QR looks designed and scans worse, and the
      // brand coral does not have the contrast ratio a scanner wants.
      dark: "#0f1212ff",
      light: "#ffffffff",
    },
  });
}

/** The public URL a code resolves to. Printed under the QR so it can be typed. */
export function growthLinkUrl(siteUrl: string, locale: string, code: string) {
  return `${siteUrl.replace(/\/$/, "")}/${locale}/go/${code}`;
}
