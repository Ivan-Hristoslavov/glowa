# GLOWA visual assets

Where every image in `public/brand/` came from, and why it looks the way it
does. Anyone regenerating or extending the set should start here.

## Provenance

All photographic and illustrative assets were generated for this project with
**OpenAI image generation** (`gpt-image-2.5-sunburst`, 2026-09-22) from the
prompts below, then converted to WebP with `sips`. Nothing is stock, nothing is
scraped, no real person or real salon is depicted, and no third-party logo
appears in any file.

The originating PNGs are not committed — they are ~1.5–2 MB each and the WebP
derivatives are what the app serves. Re-run the generation script with the
prompts here to reproduce them.

## Art direction

One paragraph is appended to every photographic prompt, which is what makes the
set read as one family rather than a pile of images:

> Warm natural daylight, calm cream and warm-neutral palette with muted coral
> and soft sage accents. Editorial, unhurried, documentary rather than stock.
> Natural skin texture, real-looking people of varied ages and appearances,
> never a posed catalogue smile. Shallow depth of field, soft shadows.
> Absolutely no text, no letters, no numbers, no logos, no signage, no
> watermarks anywhere in the image.

And for the flat illustrations:

> Flat editorial vector illustration on a plain warm-cream background. Muted
> coral, soft sage and near-black ink only. Simple confident shapes, generous
> negative space, thin consistent line weight, no gradients, no drop shadows,
> no 3D. Absolutely no text, no letters, no numbers, no logos anywhere.

The "no text" clause matters twice over: text baked into an image cannot be
translated into Bulgarian, English and Romanian, and a generated glyph is
usually malformed anyway.

## What is *not* generated

- **The G mark and wordmark** — hand-authored SVG in
  `src/components/brand/glowa-logo.tsx`. It has to stay legible at 16px, work
  in monochrome, and follow `currentColor`.
- **The feature icon family** — hand-drawn SVG in
  `src/components/brand/feature-icons.tsx`. A raster icon at 20–24px is mush,
  and these must inherit the text colour on cream, on ink and over a photo.
- **The favicon / app icon** — `src/app/icon.svg`, built from the same mark.

Generated imagery is supporting material. The core booking and admin surfaces
stay crisp, fast and typographic; no screen is turned into an image collage.

## The set

| File | Size served | Used by |
| --- | --- | --- |
| `hero-salon-light.webp` | 1600w | Landing hero, light theme |
| `hero-salon-dark.webp` | 1600w | Landing hero, dark theme (lit for dark, not dimmed) |
| `hero-mobile.webp` | 1100w | Growth section; portrait crop |
| `category-hair/barber/nails/skincare/lashes/spa.webp` | 900w | Business cards and profile heroes with no cover of their own |
| `cover-hair-lab/black-scissors/bloom-nails.webp` | 1400w | The three seeded demo salons |
| `empty-bookings/calendar/clients/campaigns.webp` | 600w | Empty states |

`src/lib/brand-assets.ts` is the only place these paths are written down, and
`fallbackBusinessImage()` encodes the rule: a business's own cover wins, then
generated art for its category, then the brand gradient — never a photograph of
the wrong trade.

## Prompts

See `ASSETS` in the generation script (kept with the session scratch, reproduced
below) for the per-asset prompt. Each is one or two sentences of subject plus
the shared direction above.

- **hero-salon-light** — a woman mid-conversation with her stylist in a modern
  European salon, warm afternoon light, empty left third for text.
- **hero-salon-dark** — the same salon after dark; warm lamp light on deep
  green-black walls, darker empty space on the right half.
- **hero-mobile** — vertical; a young woman leaving a studio, glancing at her
  phone, space at the top for text.
- **category-\*** — a close editorial frame of the trade itself (colourist's
  hands, beard trim, overhead manicure, facial treatment, lash work, a spa room
  with nobody in it).
- **cover-\*** — interiors with nobody in frame, one per demo salon's character.
- **empty-\*** — an open appointment book, an empty calendar grid with one
  coral square, three portrait silhouettes, an envelope with a small heart.

## Regenerating

The generation script is resumable: an asset whose PNG already exists is
skipped, so a failed run can be repeated without paying for the same image
twice. `OPENAI_API_KEY` must be set in the server environment; it is never
committed and never reaches the browser.
