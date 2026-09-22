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
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TILES.map((tile) => (
        <li key={tile.category}>
          <Link
            href={`/search?category=${tile.category}`}
            className="glowa-focus group relative block aspect-[4/3] overflow-hidden rounded-xl"
          >
            <Image
              src={tile.image}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            {/* A scrim rather than a flat overlay: the label stays readable on a
                bright frame without dulling the whole photograph. */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
            />
            <span className="absolute inset-x-0 bottom-0 p-4 text-sm font-medium text-white">
              {categories(tile.category)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
