/**
 * Generate the GLOWA image set with OpenAI.
 *
 * Previously this lived in a scratch directory, which meant the committed
 * WebP files could not actually be reproduced by anyone else. It belongs here.
 *
 *   OPENAI_API_KEY=… node scripts/generate-brand-assets.mjs [options]
 *
 *   --out <dir>        where the PNGs land (default: .assets-src)
 *   --model <id>       image model (default: gpt-image-2.5-sunburst)
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
const MODEL = flag("model", "gpt-image-2.5-sunburst");
const ONLY = flag("only");
const FORCE = args.includes("--force");

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("OPENAI_API_KEY is not set. It lives in .env.local, never in the repo.");
  process.exit(2);
}

/**
 * The house style, appended to every photographic prompt. This paragraph is
 * what makes the set read as one family rather than a pile of images.
 *
 * The photographic half is deliberately specific about camera, light and skin:
 * without that, image models drift towards the glossy retouched stock look
 * that the whole brand is trying not to be. "This is a photograph, not an
 * illustration" earns its place - dropping it brings back the CGI sheen.
 */
const PHOTO = `
Documentary photograph on a full-frame camera, 50mm f/1.8, natural light only.
Warm cream and warm-neutral palette with muted coral and soft sage accents.
Unposed and unhurried - people caught mid-action, never a catalogue smile.
Visible natural skin texture and pores, stray hairs, fabric weave, honest
imperfection. Shallow depth of field, soft natural shadows, subtle film grain,
true-to-life colour. Real-looking people of varied ages and appearances.
This is a photograph: not an illustration, not CGI, not a 3D render, not
retouched stock. Absolutely no text, letters, numbers, logos, signage or
watermarks anywhere in the image.`.trim().replace(/\s+/g, " ");

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
      "A woman in her thirties mid-conversation with her hairstylist in a modern European salon, warm late-afternoon window light raking across the room. She is turned slightly away from camera, caught mid-sentence. Real mirrors and real reflections behind them. The left third of the frame stays calm and uncluttered for text.",
  },
  {
    name: "hero-salon-dark",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The same kind of salon after dark: warm lamp light pooling on deep green-black walls, one stylist finishing up, the room quiet. Moody but warm, never cold or blue. The right half of the frame stays dark and uncluttered for text.",
  },
  {
    name: "hero-mobile",
    size: "portrait",
    style: PHOTO,
    prompt:
      "Vertical frame: a young woman stepping out of a small studio onto a sunlit street, glancing down at her phone, hair freshly done. Candid, mid-stride. Clear calm space at the top of the frame for text.",
  },
  {
    name: "hero-barber",
    size: "landscape",
    style: PHOTO,
    prompt:
      "A barber leaning in to finish a fade, clippers in hand, the client's shoulders under a cape. Close, warm, concentrated. Tiled wall and worn wooden counter in soft focus behind.",
  },
  {
    name: "hero-spa",
    size: "landscape",
    style: PHOTO,
    prompt:
      "A treatment room at rest: folded linen, a stone bowl, a single candle, light falling through a linen curtain. Nobody in frame. Calm, expensive, unstyled.",
  },

  // --- category cards -----------------------------------------------------
  {
    name: "category-hair",
    size: "square",
    style: PHOTO,
    prompt:
      "Close editorial frame of a colourist's hands sectioning long hair with a tail comb, foil in the other hand. Only hands and hair in frame.",
  },
  {
    name: "category-barber",
    size: "square",
    style: PHOTO,
    prompt:
      "Close frame of a beard trim in progress: scissors and comb, the barber's hands, part of the client's jaw. Warm skin tones, real stubble texture.",
  },
  {
    name: "category-nails",
    size: "square",
    style: PHOTO,
    prompt:
      "Overhead frame of a manicure in progress on a small table: one hand resting, the technician's hands working, a few bottles out of focus. Muted coral polish.",
  },
  {
    name: "category-skincare",
    size: "square",
    style: PHOTO,
    prompt:
      "A facial treatment mid-way: gloved hands applying product to a reclining client's cheek, eyes closed, towel around the hairline. Soft even light.",
  },
  {
    name: "category-lashes",
    size: "square",
    style: PHOTO,
    prompt:
      "Very close frame of lash work: tweezers near a closed eye, the technician's hands steady, magnifying lamp light. Skin texture visible.",
  },
  {
    name: "category-spa",
    size: "square",
    style: PHOTO,
    prompt:
      "An empty spa room with nobody in it: a massage table dressed in white linen, rolled towels, a small plant, warm low light.",
  },

  // --- demo salon covers --------------------------------------------------
  {
    name: "cover-hair-lab",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The interior of a small bright hair studio with nobody in frame: two chairs, a long mirror, pale wood and cream walls, plants on the windowsill.",
  },
  {
    name: "cover-black-scissors",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The interior of a dark masculine barbershop with nobody in frame: black tile, brass fittings, worn leather chairs, a row of bottles on a wooden shelf.",
  },
  {
    name: "cover-bloom-nails",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The interior of a small nail studio with nobody in frame: a pale table, a curved lamp, a wall of polish bottles in muted tones, dried flowers in a vase.",
  },

  // --- showcase salon ----------------------------------------------------
  // A fully furnished demo business, so the product can be judged with a
  // real-looking salon in it: its cover, a portfolio, and its team. The
  // people are generated and depict nobody real.
  {
    name: "showcase-cover",
    size: "landscape",
    style: PHOTO,
    prompt:
      "The interior of an airy hair and beauty atelier in a Sofia apartment building with nobody in frame: tall windows, herringbone parquet, three styling chairs facing arched mirrors, cream plaster walls, olive trees in pots, warm morning light. The left third of the frame stays calm for text.",
  },
  {
    name: "showcase-gallery-1",
    size: "square",
    style: PHOTO,
    prompt:
      "The back of a woman's head showing freshly finished soft balayage waves, honey and caramel tones, loose and glossy, salon mirror softly out of focus. Only hair and shoulders in frame.",
  },
  {
    name: "showcase-gallery-2",
    size: "square",
    style: PHOTO,
    prompt:
      "Side profile of a precise chin-length bob just after the cut, blunt line catching the window light, the stylist's hand with scissors just leaving the frame.",
  },
  {
    name: "showcase-gallery-3",
    size: "square",
    style: PHOTO,
    prompt:
      "Overhead frame of a colourist's trolley: two mixing bowls with colour, tint brushes, foils folded neatly, a small digital scale, warm light. Objects only.",
  },
  {
    name: "showcase-gallery-4",
    size: "square",
    style: PHOTO,
    prompt:
      "Defined natural curls being styled with a diffuser, the client's face turned away, curls springy and shiny, warm window light.",
  },
  {
    name: "showcase-gallery-5",
    size: "square",
    style: PHOTO,
    prompt:
      "A calm washing station: a reclined basin chair, folded warm towels, amber bottles on a wooden shelf, a linen curtain. Nobody in frame.",
  },
  {
    name: "showcase-gallery-6",
    size: "square",
    style: PHOTO,
    prompt:
      "Close detail of a soft bridal low bun with delicate loose strands and a small sprig of dried flowers pinned in, seen from behind.",
  },
  {
    name: "showcase-staff-1",
    size: "square",
    style: PHOTO,
    prompt:
      "Environmental portrait of a hairstylist in her early thirties standing in her salon, linen apron, dark hair tied back, relaxed half-smile, looking just past the camera. Head and shoulders, background softly blurred.",
  },
  {
    name: "showcase-staff-2",
    size: "square",
    style: PHOTO,
    prompt:
      "Environmental portrait of a colourist in his forties with a short grey-flecked beard, black shirt with rolled sleeves, arms loosely crossed, calm expression. Head and shoulders, warm salon background softly blurred.",
  },
  {
    name: "showcase-staff-3",
    size: "square",
    style: PHOTO,
    prompt:
      "Environmental portrait of a young stylist in her mid-twenties with curly auburn hair, cream knit top, laughing slightly mid-conversation off camera. Head and shoulders, bright salon background softly blurred.",
  },
  {
    name: "showcase-staff-4",
    size: "square",
    style: PHOTO,
    prompt:
      "Environmental portrait of a brow and lash artist in her forties with a sleek low ponytail and small gold earrings, sage green tunic, composed and warm. Head and shoulders, treatment room softly blurred behind.",
  },

  // --- social backdrop ----------------------------------------------------
  {
    name: "og-backdrop",
    size: "landscape",
    style: PHOTO,
    prompt:
      "An abstract warm salon interior far out of focus, reading as texture rather than a scene: cream and coral bokeh, a suggestion of a mirror and a window. Nothing identifiable, plenty of calm space.",
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
