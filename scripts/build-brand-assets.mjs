/**
 * Convert the generated PNGs into the WebP files the app serves.
 *
 * The originals are large (1.5-2 MB each) and stay out of the repository; only
 * these derivatives are committed. Re-runnable and idempotent.
 *
 *   node scripts/build-brand-assets.mjs <source-dir> [dest-dir]
 */
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
const dest = process.argv[3] ?? "public/brand";

if (!source) {
  console.error("usage: node scripts/build-brand-assets.mjs <source-dir> [dest-dir]");
  process.exit(2);
}

// Width and quality per role: heroes carry the page, category and cover art is
// never shown larger than a card, flat illustrations compress hard.
const RULES = [
  { match: /^hero-/, width: 1600, quality: 80 },
  { match: /^(category|cover)-/, width: 1100, quality: 76 },
  { match: /^empty-/, width: 600, quality: 82 },
];

await mkdir(dest, { recursive: true });

const files = (await readdir(source)).filter(
  (name) => name.endsWith(".png") && !name.startsWith("_") && name !== "test.png",
);

let total = 0;
for (const name of files.sort()) {
  const base = name.replace(/\.png$/, "");
  const rule = RULES.find((candidate) => candidate.match.test(base));
  if (!rule) {
    console.log(`${base.padEnd(24)} skipped (no rule)`);
    continue;
  }

  const target = path.join(dest, `${base}.webp`);
  const info = await sharp(path.join(source, name))
    .resize({ width: rule.width, withoutEnlargement: true })
    .webp({ quality: rule.quality })
    .toFile(target);

  total += info.size;
  console.log(
    `${base.padEnd(24)} ${String(info.width).padStart(4)}w  ${(info.size / 1024).toFixed(0).padStart(4)} KB`,
  );
}

console.log(`\n${files.length} files · ${(total / 1024 / 1024).toFixed(2)} MB total`);
