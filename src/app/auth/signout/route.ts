import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = request.nextUrl.searchParams.get("locale");
  const safeLocale = (routing.locales as readonly string[]).includes(locale ?? "")
    ? locale
    : routing.defaultLocale;

  return NextResponse.redirect(new URL(`/${safeLocale}`, request.nextUrl.origin), {
    status: 303,
  });
}
