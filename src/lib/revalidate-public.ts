import "server-only";

import { revalidatePath } from "next/cache";

import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * The public surfaces that show a salon's data are cached for an hour (the
 * salon page, search, the home page, the service-by-town pages). That is right
 * for visitors and wrong for the owner who has just changed a price, answered
 * a review or published: they look at the page and see the old one. Any action
 * that changes what those pages show calls this once it has succeeded.
 *
 * The salon's own page is revalidated by its literal path, in every language.
 * A route pattern (`/[locale]/business/[slug]`) did not reliably reach the
 * prerendered copies in a production build - an edit saved and the page stayed
 * as it was - so the pattern is kept for the listings and the literal path is
 * what the owner actually sees refresh.
 */
export async function revalidatePublicSurfaces(businessId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", businessId)
    .maybeSingle();

  if (data?.slug) {
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}/business/${data.slug}`);
    }
  }

  revalidatePath("/[locale]/business/[slug]", "page");
  revalidatePath("/[locale]/search", "page");
  revalidatePath("/[locale]/salons/[category]/[city]", "page");
  revalidatePath("/[locale]", "page");
}
