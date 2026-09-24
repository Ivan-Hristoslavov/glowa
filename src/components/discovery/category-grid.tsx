import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { categoryImages } from "@/lib/brand-assets";
import type { BusinessCategory } from "@/lib/business-categories";

/**
 * Photography that does a job: each tile is a filter, so browsing by picture
 * lands on a real result set rather than a decorative dead end.
 */
const TILES: Array<{ category: BusinessCategory; image: string }> = [
  { category: "hair_salon", image: categoryImages.hair },
  { category: "barbershop", image: categoryImages.barber },
  { category: "nail_studio", image: categoryImages.nails },
  { category: "skincare", image: categoryImages.skincare },
  { category: "lash_brow", image: categoryImages.lashes },
  { category: "spa", image: categoryImages.spa },
];

export async function CategoryGrid() {
  const categories = await getTranslations("categories");

  return (
    // Two up on a phone. At one per row these six 4:3 photographs ran to
    // roughly two thousand pixels of scrolling before anything else on the
    // page, which is a lot of travel to choose a filter.
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {TILES.map((tile) => (
        <li key={tile.category} className="glowa-reveal">
          <Link
            href={`/search?category=${tile.category}`}
            className="glowa-focus group relative block aspect-square overflow-hidden rounded-2xl sm:aspect-[4/3] sm:rounded-3xl"
          >
            <Image
              src={tile.image}
              alt=""
              fill
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-[900ms] ease-[var(--ease-glowa)] group-hover:scale-[1.07]"
            />
            {/* A scrim rather than a flat overlay: the label stays readable on a
                bright frame without dulling the whole photograph. */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent transition-opacity duration-500 group-hover:opacity-90"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-white sm:p-5">
              <span className="font-heading text-base leading-tight sm:text-2xl">
                {categories(tile.category)}
              </span>
              <span
                aria-hidden
                className="hidden size-9 shrink-0 translate-y-2 items-center justify-center rounded-full bg-white/90 text-[#0f1212] opacity-0 transition-all duration-500 ease-[var(--ease-glowa)] group-hover:translate-y-0 group-hover:opacity-100 sm:flex"
              >
                <ArrowUpRight className="size-4" />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
