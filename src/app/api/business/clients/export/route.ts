import { requireMembership } from "@/lib/actions/guard";
import { getActiveMembership } from "@/lib/queries/business";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLUMNS = [
  "full_name",
  "email",
  "phone",
  "total_visits",
  "total_spend_cents",
  "first_visit_at",
  "last_visit_at",
  "consent_marketing",
  "tags",
  "notes",
] as const;

/**
 * A spreadsheet cannot tell a formula from a name that starts with "=", so a
 * client called "=HYPERLINK(...)" would run when the salon opens the file.
 * Such cells are prefixed with an apostrophe, the conventional neutraliser.
 */
function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value) ? value.join("; ") : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The salon's client list, as a CSV it can take anywhere.
 *
 * "Can I get my clients out?" is the first thing owners ask of a booking
 * platform, usually after one has made it hard. This answers it with a file:
 * every client of the active business, read through RLS as the signed-in
 * member, so nobody can export a salon they do not work at. Managers and up
 * only - it is the whole contact book.
 */
export async function GET() {
  const membership = await getActiveMembership();
  if (!membership) return new Response("Not found", { status: 404 });

  const guard = await requireMembership(membership.businessId, "manager");
  if (!guard.ok) return new Response("Forbidden", { status: 403 });

  const { data, error } = await guard.supabase
    .from("business_clients")
    .select(COLUMNS.join(", "))
    .eq("business_id", membership.businessId)
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) return new Response("Export failed", { status: 500 });

  const rows = (data ?? []) as unknown as Array<Record<(typeof COLUMNS)[number], unknown>>;
  const lines = [
    COLUMNS.join(","),
    ...rows.map((row) => COLUMNS.map((column) => cell(row[column])).join(",")),
  ];

  // The BOM is what makes Excel read the file as UTF-8, so Cyrillic names
  // arrive as names rather than mojibake.
  const body = `﻿${lines.join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="glowa-clients-${membership.slug}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
