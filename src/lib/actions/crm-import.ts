"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMembership } from "@/lib/actions/guard";
import {
  IMPORT_CHUNK_SIZE,
  cleanImportRow,
  emptyContacts,
  isKnownContact,
  rememberContact,
} from "@/lib/crm/import";

export type ImportClientsResult =
  | { ok: true; imported: number; skipped: number; invalid: number }
  | { ok: false; code: string };

const importSchema = z.object({
  businessId: z.uuid(),
  rows: z
    .array(
      z.object({
        fullName: z.string().max(400),
        email: z.string().max(400),
        phone: z.string().max(100),
        notes: z.string().max(9000),
      }),
    )
    .min(1)
    .max(IMPORT_CHUNK_SIZE),
});

const PAGE = 1000;

/**
 * Adds clients from a file to this salon's CRM.
 *
 * The browser has already parsed and previewed the file; none of that is
 * trusted here. Every row is cleaned again, and anyone the salon already has -
 * by email, by phone in any spelling, or by name when there is nothing else -
 * is skipped rather than doubled. Because each call reads the CRM afresh, a
 * large file sent in several calls dedupes against its own earlier parts too.
 *
 * What an import deliberately does not do: it records no marketing consent
 * (`consent_marketing` stays false and no date is stamped, because nobody was
 * asked), and it creates no visits or spend. Those come from real bookings.
 */
export async function importBusinessClients(
  input: z.input<typeof importSchema>,
): Promise<ImportClientsResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };

  const guard = await requireMembership(parsed.data.businessId, "manager");
  if (!guard.ok) return guard;

  // Everyone the salon already has. Paged: PostgREST caps a response at 1000.
  const known = emptyContacts();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await guard.supabase
      .from("business_clients")
      .select("full_name, email, phone")
      .eq("business_id", parsed.data.businessId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return { ok: false, code: "generic" };
    for (const row of data ?? []) {
      rememberContact(known, { fullName: row.full_name, email: row.email, phone: row.phone });
    }
    if (!data || data.length < PAGE) break;
  }

  const fresh: Array<{
    business_id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  }> = [];
  let invalid = 0;
  let skipped = 0;

  for (const raw of parsed.data.rows) {
    const row = cleanImportRow({
      name: raw.fullName,
      email: raw.email,
      phone: raw.phone,
      notes: raw.notes,
    });
    if (!row) {
      invalid += 1;
    } else if (isKnownContact(known, row)) {
      skipped += 1;
    } else {
      rememberContact(known, row);
      fresh.push({
        business_id: parsed.data.businessId,
        full_name: row.fullName || null,
        email: row.email || null,
        phone: row.phone || null,
        notes: row.notes || null,
      });
    }
  }

  if (fresh.length > 0) {
    // RLS decides again: only a manager of this business may insert.
    const { error } = await guard.supabase.from("business_clients").insert(fresh);
    if (error) return { ok: false, code: error.code === "42501" ? "forbidden" : "generic" };
  }

  revalidatePath("/[locale]/dashboard/clients", "page");
  return { ok: true, imported: fresh.length, skipped, invalid };
}
