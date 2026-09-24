# GLOWA visual assets

Where every image in `public/brand/` came from, and why it looks the way it
does. Anyone regenerating or extending the set should start here.

## Provenance

All photographic and illustrative assets were generated for this project with
**OpenAI image generation**, then converted to WebP with `sharp`. Nothing is
stock, nothing is scraped, no real person or real salon is depicted, and no
third-party logo appears in any file.

| Set | Model | Date |
| --- | --- | --- |
| Photographs (heroes, categories, covers, OG backdrop) | `gpt-image-2.5-flare` | 2026-09-23 |
| Flat illustrations (`feature-*`, `empty-*`) | `gpt-image-2.5-sunburst` | 2026-09-22 |

**Why two models.** The first photographic pass used `sunburst` and came out
glossy and posed — retouched-stock, which is the one thing the brand is not.
The same prompts were run through both 2.5 models side by side: `flare` gave
warmer light, more honest skin, and crucially left the calm third of the frame
the layout needs for text. The illustrations were left on `sunburst`; they are
marks behind UI copy at 600px, and re-rolling them would only shuffle
randomness.

**The prompts did more work than the model swap.** Naming the camera, the lens
and the light, asking for pores, stray hairs and fabric weave, and stating
outright that this is a photograph and not a render is what moved the set from
catalogue to documentary.

The originating PNGs are not committed — they are ~1.5–2 MB each and the WebP
derivatives are what the app serves. `scripts/generate-brand-assets.mjs` holds
every prompt and reproduces the set.

## Second direction (2026-09-24) — pending regeneration

The first photographic set was judged by the product owner to *look generated*,
and they were right: every frame shared one honey-coloured light, one
cream/coral/sage palette, linen, candles and a plant placed for composition.
Real salon photographs do not coordinate. They are taken on a phone by someone
who works there, under the room's own mixed light, in a room that is in use.

`scripts/generate-brand-assets.mjs` now carries a new photographic direction and
new per-asset prompts written from that observation:

- **Named imperfection** — smartphone capture, daylight mixed with overhead LED
  panels (uneven white balance), handheld framing, motion in hands, sensor
  noise, ungraded colour.
- **A room in use** — bottles with labels turned away, a hairdryer cable, clips,
  a coffee cup and a phone on the counter, cut hair on the floor, worn chairs.
- **People who are not models** — Eastern European, varied ages and builds,
  pores and flyaways, nobody posing or smiling at the lens.
- **Forbidden props** — candles, dried flowers, linen styling, plants placed for
  composition, colour-coordinated anything.
- **The brand palette is removed from the prompt.** Asking for "muted coral and
  sage accents" is what made every picture match the UI, and matching the UI is
  what made them look made-up.
- **Local, specific situations** — a ground-floor salon in a Sofia apartment
  block on a Saturday morning, a barber doing a skin fade while the client
  scrolls his phone, a nail desk with a UV lamp and a dust extractor.

The set has **not been regenerated yet**: the session that wrote the prompts had
no image-model access (no `OPENAI_API_KEY` in its environment, and the Higgsfield
account had no credits). The committed WebP files are still the first set.
Regenerate with the commands under *Regenerating* below; the script's default
model is now `gpt-image-2.5-flare`. The flat illustrations are unchanged and
were made with `sunburst` — pass `--model gpt-image-2.5-sunburst --only feature`
(or `--only empty`) if they ever need re-rolling.

## Art direction (first set, 2026-09-22/23)

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

## Typography

Not generated either, and not picked from a specimen: the five candidate
pairings were rendered with the product's own Bulgarian and Romanian strings
and compared side by side. **Onest** (UI) + **Playfair Display** (headings)
won. Both carry `latin`, `latin-ext` and `cyrillic`, which Romanian `ș`/`ț`
and Bulgarian both need.

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
| `hero-mobile.webp` | 1600w | Growth section; portrait crop |
| `hero-barber.webp`, `hero-spa.webp` | 1600w | Spare hero exposures |
| `category-hair/barber/nails/skincare/lashes/spa.webp` | 1100w | Business cards and profile heroes with no cover of their own |
| `cover-hair-lab/black-scissors/bloom-nails.webp` | 1100w | The three seeded demo salons |
| `feature-*.webp` (10) | 600w | Landing feature grid, settings, marketing |
| `empty-*.webp` (5 light + 4 dark) | 600w | Empty states, per theme |
| `og-cover.webp` | 1200×630 | Social share card |

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

## The social card and the app icon

`npm run assets:social <backdrop.png>` composes `og-cover.webp` from the
generated backdrop plus a warm scrim, the mark and the wordmark, and writes
`src/app/apple-icon.png` from the same geometry. The wordmark is set in the real
UI font rather than a system fallback: `FONTCONFIG_FILE` points librsvg at a
directory holding Onest, so nothing is installed on the machine that runs it.

Without an OG image a shared link renders as a bare URL in every messenger,
which is why this is not optional polish.

## Regenerating

```
OPENAI_API_KEY=… node scripts/generate-brand-assets.mjs --out .assets-src \
  --model gpt-image-2.5-flare
node scripts/build-brand-assets.mjs .assets-src
npm run assets:social .assets-src/og-backdrop.png
```

The generation script lives in the repository now rather than in a scratch
directory — the committed WebP files could not previously be reproduced by
anyone else, which made the provenance above unverifiable.

It is resumable: an asset whose PNG already exists is skipped, so a failed run
can be repeated without paying for the same image twice. `--only <name>`
regenerates one, `--force` overwrites. `OPENAI_API_KEY` must be in the server
environment; it is never committed and never reaches the browser.
