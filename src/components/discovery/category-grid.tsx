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
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {TILES.map((tile) => (
        <li key={tile.category}>
          <Link
            href={`/search?category=${tile.category}`}
            className="glowa-focus group relative block aspect-square overflow-hidden rounded-xl sm:aspect-[4/3]"
          >
            <Image
              src={tile.image}
              alt=""
              fill
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            {/* A scrim rather than a flat overlay: the label stays readable on a
                bright frame without dulling the whole photograph. */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
            />
            <span className="absolute inset-x-0 bottom-0 p-3 text-xs font-medium text-white sm:p-4 sm:text-sm">
              {categories(tile.category)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
