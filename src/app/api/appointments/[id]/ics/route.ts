import { NextResponse, type NextRequest } from "next/server";

import { buildIcs } from "@/lib/calendar";
import { pickLocalized } from "@/lib/localized";
import { routing, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * Downloads one appointment as an .ics file.
 *
 * Lives under /api so the proxy skips it, and reads through the normal
 * request-scoped client: RLS is what decides whether this appointment belongs
 * to the caller, so an id guessed from elsewhere returns 404, not a file.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const requested = request.nextUrl.searchParams.get("locale");
  const locale = (
    routing.locales.includes(requested as Locale) ? requested : routing.defaultLocale
  ) as Locale;

  const supabase = await createClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      `
      id, starts_at, ends_at, customer_notes, service_name_snapshot,
      businesses ( name, timezone, slug ),
      services ( name ),
      staff_profiles ( display_name ),
      locations ( name, address_line1, city )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !appointment) {
    return new NextResponse("Not found", { status: 404 });
  }

  const businessName = appointment.businesses?.name ?? "glowa";
  const serviceName =
    pickLocalized(appointment.services?.name, locale) ||
    pickLocalized(appointment.service_name_snapshot, locale);

  const location = appointment.locations
    ? [
        appointment.locations.name,
        appointment.locations.address_line1,
        appointment.locations.city,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const ics = buildIcs({
    uid: appointment.id,
    title: serviceName ? `${serviceName} · ${businessName}` : businessName,
    description: [
      appointment.staff_profiles?.display_name
        ? `${appointment.staff_profiles.display_name}`
        : null,
      appointment.customer_notes,
    ]
      .filter(Boolean)
      .join("\n"),
    location,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="glowa-${appointment.id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
