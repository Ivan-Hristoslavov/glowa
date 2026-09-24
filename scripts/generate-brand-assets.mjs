/**
 * Generate the GLOWA image set with OpenAI.
 *
 * Previously this lived in a scratch directory, which meant the committed
 * WebP files could not actually be reproduced by anyone else. It belongs here.
 *
 *   OPENAI_API_KEY=… node scripts/generate-brand-assets.mjs [options]
 *
 *   --out <dir>        where the PNGs land (default: .assets-src)
 *   --model <id>       image model (default: gpt-image-2.5-flare)
 *   --only <pattern>   substring filter on the asset name
 *   --force            regenerate even if the PNG already exists
 *
 * Resumable by default: an asset whose PNG is already on disk is skipped, so a
 * failed run can be repeated without paying for the same image twice.
 *
 * The PNGs are not committed - they are 1.5-2 MB each. Run
 * `npm run assets:build <out-dir>` afterwards to write the WebP files the app
 * actually serves.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
function flag(name, fallback = undefined) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
}

const OUT = flag("out", ".assets-src");
const MODEL = flag("model", "gpt-image-2.5-flare");
const ONLY = flag("only");
const FORCE = args.includes("--force");

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("OPENAI_API_KEY is not set. It lives in .env.local, never in the repo.");
  process.exit(2);
}

/**
 * The house style, appended to every photographic prompt.
 *
 * Second direction (2026-09-24). The first set read as generated: every frame
 * shared one honey light, one cream-coral-sage palette, linen, candles and a
 * plant placed for composition. Real salon photographs do not coordinate. They
 * are taken on a phone by someone who works there, under the room's own mixed
 * light, in a room that is in use. So the direction now names what a styled
 * shoot removes - clutter, uneven white balance, worn furniture, people who
 * are not models - and forbids what it adds.
 *
 * The brand colours are deliberately NOT in the prompt any more. Asking for
 * "muted coral and sage accents" is exactly what made every picture match the
 * UI, and matching the UI is what made them look made-up.
 */
const PHOTO = `
A real, unretouched photograph taken on a recent smartphone by someone who
works there - not a production, not a campaign. Available light only: window
daylight mixed with the room's own overhead LED panels, so the white balance is
slightly uneven. Handheld, slightly imperfect framing, a little motion blur in
moving hands, mild sensor noise in the shadows, colours straight out of the
camera and not graded. Ordinary Eastern European people of different ages and
builds, real skin with pores, blemishes and flyaway hair, natural expressions,
nobody posing and nobody smiling at the camera. The room is really in use:
product bottles with labels turned away or out of focus, a hairdryer cable,
clips, a spray bottle, a phone and a coffee cup on the counter, cut hair on the
floor, chairs with a little wear. Nothing is arranged for the picture: no
colour-coordinated props, no candles, no dried flowers, no linen styling, no
plants placed for composition. This is a photograph, not an illustration, not
CGI, not a 3D render, not retouched stock. Absolutely no readable text,
letters, numbers, logos, signage or watermarks anywhere in the image.`.trim().replace(/\s+/g, " ");

/**
 * The illustrations stay illustrations. Making these "more real" would break
 * the design system: they sit behind UI copy at 600px and read as marks, not
 * pictures.
 */
const FLAT = `
Flat editorial vector illustration on a plain warm-cream background. Muted
coral, soft sage and near-black ink only. Simple confident shapes, generous
negative space, thin consistent line weight, no gradients, no drop shadows, no
3D, objects only with no people or characters. Absolutely no text, letters,
numbers or logos anywhere.`.trim().replace(/\s+/g, " ");

/** `landscape` for heroes, `square` for cards, `portrait` for the mobile hero. */
const SIZES = {
  landscape: "1536x1024",
  portrait: "1024x1536",
  square: "1024x1024",
};

const ASSETS = [
  // --- heroes -------------------------------------------------------------
  {
    name: "hero-salon-light",
    size: "landscape",
    style: PHOTO,
    prompt:
      "A Saturday morning in a busy neighbourhood hair salon on the ground floor of a Sofia apartment block. A stylist in her forties in a plain black T-shirt blow-dries a client's shoulder-length hair with a round brush; the client is laughing at something and holding her phone. Behind them a second client sits under foils, large plain mirrors, a glass shelf of products, and through the shop window the street and a parked car. The left third of the frame is less busy, a wall and part of the window.",
  },
  {
    name: "hero-salon-dark",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The same kind of neighbourhood salon on a weekday evening after the street lights have come on: warm ceiling spotlights and a lamp at the reception counter, one stylist sweeping cut hair while the last client pays at the counter, the dark street visible through the window. A real low-light phone photo with some grain, warm but not orange. The right half of the frame is darker and quieter.",
  },
  {
    name: "hero-mobile",
    size: "portrait",
    style: PHOTO,
    prompt:
      "Vertical phone photo: a woman in her late twenties walking out of a salon door onto a Sofia pavement with old façades and tram wires overhead, looking down at her phone, freshly blow-dried hair moving as she walks. Overcast soft daylight. The top of the frame is building and sky, calm enough for text.",
  },
  {
    name: "hero-barber",
    size: "landscape",
    style: PHOTO,
    prompt:
      "A barber in his thirties with tattooed forearms doing a skin fade with clippers on a young man's neck while the client scrolls his phone under the cape. A long wall mirror, a television showing football out of focus in the background, a black barber chair with wear on the armrest, cut hair on the cape.",
  },
  {
    name: "hero-spa",
    size: "landscape",
    style: PHOTO,
    prompt:
      "A small massage room in a city day spa between two clients: a massage table with a fresh paper sheet and a folded towel, oil bottles on a small trolley, a wall heater, blinds half closed. Real, slightly cramped, clean. Nobody in frame.",
  },

  // --- category cards -----------------------------------------------------
  {
    name: "category-hair",
    size: "square",
    style: PHOTO,
    prompt:
      "A colourist in black gloves painting colour onto a client's roots with a tint brush, the colour bowl in her other hand and foil strips on the trolley beside her. Shot over the stylist's shoulder; the client's face is partly visible in the mirror.",
  },
  {
    name: "category-barber",
    size: "square",
    style: PHOTO,
    prompt:
      "Close shot of a barber lining up a beard with a trimmer, a comb in his other hand, cut hair scattered on the black cape, the client's eyes half closed.",
  },
  {
    name: "category-nails",
    size: "square",
    style: PHOTO,
    prompt:
      "A nail technician filing a client's nails at a small white desk with a UV lamp and a dust extractor, rows of gel polish bottles out of focus behind, the client holding her phone in her free hand. Shot from the side at desk height.",
  },
  {
    name: "category-skincare",
    size: "square",
    style: PHOTO,
    prompt:
      "A cosmetician in a white tunic giving a facial with a steamer beside the treatment bed; the client lies with a headband and closed eyes, a magnifying lamp arm crossing the frame.",
  },
  {
    name: "category-lashes",
    size: "square",
    style: PHOTO,
    prompt:
      "A lash technician working on a client lying on a treatment bed with under-eye pads; tweezers in hand, a lash tile on a small tray, the reflection of a ring light in the client's cheek. Shot from above the technician's shoulder.",
  },
  {
    name: "category-spa",
    size: "square",
    style: PHOTO,
    prompt:
      "A massage therapist's hands working oil into a client's shoulders, a towel over the lower back, a dim warm room with the blinds down.",
  },

  // --- demo salon covers --------------------------------------------------
  {
    name: "cover-hair-lab",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The inside of a small, bright two-chair hair salon early in the morning before opening: two black hydraulic chairs, a wash basin, a trolley with brushes and a hairdryer, a reception counter with a card terminal, the street through the glass door. A real, lived-in shop. Nobody in frame.",
  },
  {
    name: "cover-black-scissors",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The inside of a barbershop on a quiet afternoon: three barber chairs, black wall tiles, a waiting bench with a coat thrown on it, products on a shelf, clippers charging on the counter, light from the street. Nobody in frame.",
  },
  {
    name: "cover-bloom-nails",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The inside of a small nail studio: two manicure desks with lamps and dust collectors, a shelf of gel polish bottles, a pedicure chair in the corner, a window with blinds. Nobody in frame.",
  },

  // --- social backdrop ----------------------------------------------------
  {
    name: "og-backdrop",
    size: "landscape",
    style: PHOTO,
    prompt:
      "A salon interior far out of focus, reading as texture rather than a scene: the blur of mirrors, ceiling lights and a window. Nothing identifiable, plenty of calm space.",
  },

  // --- flat illustrations -------------------------------------------------
  { name: "feature-booking", size: "square", style: FLAT, prompt: "An open appointment book with a pen resting on it and one square marked." },
  { name: "feature-calendar", size: "square", style: FLAT, prompt: "A wall calendar grid with a few blocks filled in, objects only." },
  { name: "feature-clients", size: "square", style: FLAT, prompt: "A stack of client record cards with a small heart on the top one." },
  { name: "feature-payments", size: "square", style: FLAT, prompt: "A card terminal and a folded receipt, objects only." },
  { name: "feature-reviews", size: "square", style: FLAT, prompt: "A speech bubble containing a single five-pointed star." },
  { name: "feature-marketing", size: "square", style: FLAT, prompt: "An envelope with a paper plane leaving it." },
  { name: "feature-analytics", size: "square", style: FLAT, prompt: "A simple bar chart with an upward trend line over it." },
  { name: "feature-assistant", size: "square", style: FLAT, prompt: "A speech bubble with a small four-pointed sparkle inside it." },
  { name: "feature-reminders", size: "square", style: FLAT, prompt: "A small alarm clock next to a folded note." },
  { name: "feature-growth", size: "square", style: FLAT, prompt: "A potted plant with one leaf unfurling, beside a rising line." },
  { name: "empty-onboarding", size: "square", style: FLAT, prompt: "An open door with light coming through it and a key beside it." },
  { name: "empty-bookings", size: "square", style: FLAT, prompt: "An empty appointment book lying open, all squares blank." },
  { name: "empty-calendar", size: "square", style: FLAT, prompt: "An empty calendar grid with exactly one square filled in coral." },
  { name: "empty-clients", size: "square", style: FLAT, prompt: "Three blank client record cards fanned out, no faces." },
  { name: "empty-campaigns", size: "square", style: FLAT, prompt: "A closed envelope with a small heart resting on it." },
];

const selected = ASSETS.filter((asset) => !ONLY || asset.name.includes(ONLY));
if (selected.length === 0) {
  console.error(`No asset matches --only ${ONLY}`);
  process.exit(2);
}

await mkdir(OUT, { recursive: true });
console.log(`model ${MODEL} · ${selected.length} asset(s) · out ${OUT}\n`);

let made = 0;
let skipped = 0;

for (const asset of selected) {
  const file = path.join(OUT, `${asset.name}.png`);

  if (!FORCE) {
    try {
      await access(file);
      console.log(`${asset.name.padEnd(24)} skipped (exists)`);
      skipped += 1;
      continue;
    } catch {
      // Not there yet, which is the normal path.
    }
  }

  const prompt = `${asset.prompt} ${asset.style}`;

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size: SIZES[asset.size],
        quality: "high",
        n: 1,
      }),
      // A high-quality generation is slow; the default fetch timeout is not.
      signal: AbortSignal.timeout(300_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.log(`${asset.name.padEnd(24)} FAILED ${response.status} ${detail.slice(0, 160)}`);
      continue;
    }

    const body = await response.json();
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) {
      console.log(`${asset.name.padEnd(24)} FAILED (no image in response)`);
      continue;
    }

    await writeFile(file, Buffer.from(b64, "base64"));
    const kb = Math.round(Buffer.from(b64, "base64").length / 1024);
    console.log(`${asset.name.padEnd(24)} ok ${String(kb).padStart(5)} KB`);
    made += 1;
  } catch (cause) {
    console.log(`${asset.name.padEnd(24)} FAILED ${cause instanceof Error ? cause.message : cause}`);
  }
}

console.log(`\n${made} generated, ${skipped} skipped.`);
console.log(`Next: node scripts/build-brand-assets.mjs ${OUT}`);
