/**
 * Builds the social share card and the Apple touch icon.
 *
 * The card is the generated backdrop with a warm scrim, the GLOWA mark and the
 * wordmark. Text is rendered with the real UI font rather than a system
 * fallback: FONTCONFIG_FILE points librsvg at a directory holding Onest, so
 * nothing is installed on the machine running this.
 *
 *   FONTCONFIG_FILE=<dir>/fonts.conf node scripts/build-social-card.mjs <backdrop.png>
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const backdrop = process.argv[2];
if (!backdrop) {
  console.error("usage: node scripts/build-social-card.mjs <backdrop.png>");
  process.exit(2);
}

const W = 1200;
const H = 630;

const SPIRAL = "M33 7.8H17A8.2 8.2 0 0 0 17 24.2H31A8.2 8.2 0 0 1 31 40.6H14";
const LEAF_A = "M19 21.5Q31 13.8 43.4 18.8Q31 25.4 19 21.5Z";
const LEAF_B = "M26.6 26.3Q14.6 34 2.2 29Q14.6 22.4 26.6 26.3Z";

const overlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="#F8F3EE" stop-opacity="0.97"/>
      <stop offset="52%" stop-color="#F8F3EE" stop-opacity="0.86"/>
      <stop offset="100%" stop-color="#F8F3EE" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>

  <g transform="translate(92 214) scale(2.05)">
    <path d="${SPIRAL}" fill="none" stroke="#D96C61" stroke-width="9.8"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${LEAF_A}" fill="#0F1212"/>
    <path d="${LEAF_B}" fill="#0F1212"/>
  </g>

  <text x="215" y="310" font-family="Onest" font-weight="700" font-size="104"
        fill="#0F1212" letter-spacing="-3">glowa</text>
  <text x="219" y="356" font-family="Onest" font-weight="700" font-size="21"
        fill="#6B625B" letter-spacing="7">BEAUTY MOVES PEOPLE</text>
  <rect x="219" y="392" width="76" height="6" rx="3" fill="#D96C61"/>
</svg>`;

await mkdir("public/brand", { recursive: true });

await sharp(backdrop)
  .resize({ width: W, height: H, fit: "cover", position: "attention" })
  .composite([{ input: Buffer.from(overlay) }])
  .webp({ quality: 86 })
  .toFile("public/brand/og-cover.webp");

// Apple wants an opaque square; the mark sits on the brand ink.
const appleIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="#0F1212"/>
  <g transform="translate(24 24) scale(0.8) translate(-24 -24)">
    <path d="${SPIRAL}" fill="none" stroke="#D96C61" stroke-width="9.8"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${LEAF_A}" fill="#F8F3EE"/>
    <path d="${LEAF_B}" fill="#F8F3EE"/>
  </g>
</svg>`;

await sharp(Buffer.from(appleIcon)).png().toFile("src/app/apple-icon.png");

const card = await sharp("public/brand/og-cover.webp").metadata();
console.log(`og-cover.webp  ${card.width}x${card.height}`);
console.log("apple-icon.png 180x180");
