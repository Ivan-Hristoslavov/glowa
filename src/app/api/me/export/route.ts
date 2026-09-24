import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * "Download my data" (GDPR art. 15 and 20): everything Glowa holds about the
 * signed-in person as a customer, as JSON. Every query filters on the caller
 * explicitly - RLS would also let a salon member read their salon's rows,
 * which are not this person's data.
 *
 * Salon-side records (a salon's client card, its notes) belong to the salon
 * as controller and are not included; the privacy policy says so.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [
    profile,
    preferences,
    notifications,
    saved,
    appointments,
    reviews,
    waitlist,
    calendars,
    push,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, locale, timezone, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("customer_preferences").select("*").eq("profile_id", userId).maybeSingle(),
    supabase
      .from("notification_preferences")
      .select("business_id, channel, event_type, enabled")
      .eq("profile_id", userId),
    supabase
      .from("saved_businesses")
      .select("created_at, businesses ( name, slug )")
      .eq("profile_id", userId),
    supabase
      .from("appointments")
      .select(
        "starts_at, ends_at, status, price_cents, currency, customer_notes, cancellation_reason, service_name_snapshot, created_at, businesses ( name, slug )",
      )
      .eq("customer_profile_id", userId)
      .order("starts_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("rating, comment, created_at, businesses ( name, slug )")
      .eq("author_profile_id", userId),
    supabase
      .from("waitlist_entries")
      .select("status, from_date, to_date, note, created_at, businesses ( name, slug )")
      .eq("profile_id", userId),
    supabase
      .from("external_calendar_connections")
      .select("provider, account_email, status, created_at")
      .eq("profile_id", userId),
    supabase.from("push_subscriptions").select("created_at").eq("profile_id", userId),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: {
      id: userId,
      email: typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null,
      ...(profile.data ?? {}),
    },
    customer_preferences: preferences.data ?? null,
    notification_preferences: notifications.data ?? [],
    saved_salons: saved.data ?? [],
    bookings: appointments.data ?? [],
    reviews: reviews.data ?? [],
    waitlist: waitlist.data ?? [],
    connected_calendars: calendars.data ?? [],
    push_devices: (push.data ?? []).length,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="glowa-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
