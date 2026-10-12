import { z } from "zod";

import { authenticate, isResponse } from "@/lib/api/auth";
import { readBody } from "@/lib/api/body";
import { fail, ok } from "@/lib/api/http";
import { Constants } from "@/types/database";
import { revalidatePublicSurfaces } from "@/lib/revalidate-public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A plain string means Bulgarian; an object may carry bg, en and ro. */
const localized = z.union([
  z.string().trim().min(1).max(200).transform((bg) => ({ bg })),
  z
    .object({
      bg: z.string().trim().min(1).max(200),
      en: z.string().trim().max(200).optional(),
      ro: z.string().trim().max(200).optional(),
    })
    .strict(),
]);

const description = z.union([
  z.string().trim().max(2000).transform((bg) => (bg ? { bg } : null)),
  z
    .object({
      bg: z.string().trim().max(2000).optional(),
      en: z.string().trim().max(2000).optional(),
      ro: z.string().trim().max(2000).optional(),
    })
    .strict(),
  z.null(),
]);

const schema = z
  .object({
    name: localized,
    description: description.optional(),
    category: z.enum(Constants.public.Enums.service_category).optional(),
    duration_minutes: z.number().int().min(5).max(1440),
    price_cents: z.number().int().min(0).max(10_000_000),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    buffer_before_minutes: z.number().int().min(0).max(240).optional(),
    buffer_after_minutes: z.number().int().min(0).max(240).optional(),
    is_active: z.boolean().optional(),
    staff_ids: z.array(z.uuid()).max(100).optional(),
  })
  .strict();

const idSchema = z.string().trim().min(1).max(120);

/**
 * Create or update one service, keyed by the id the salon's own site uses for
 * it. Idempotent: the same call twice is one service. Deposits are not part of
 * this - money rules stay in the salon's Lavena settings.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ externalId: string }> },
) {
  const ctx = await authenticate(request, "catalog");
  if (isResponse(ctx)) return ctx;

  const externalId = idSchema.safeParse((await context.params).externalId);
  if (!externalId.success) return fail(422, "invalid_request", "Bad service id.");

  const body = await readBody(request, schema);
  if (body instanceof Response) return body;

  // Stylists named in the call must be this salon's.
  let staffIds = body.staff_ids;
  if (staffIds) {
    const { data: own } = await ctx.db
      .from("staff_profiles")
      .select("id")
      .eq("business_id", ctx.businessId)
      .in("id", staffIds);
    if ((own ?? []).length !== new Set(staffIds).size) {
      return fail(422, "invalid_request", "A staff id does not belong to this salon.");
    }
  }

  const fields = {
    name: body.name,
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.category ? { category: body.category } : {}),
    duration_minutes: body.duration_minutes,
    price_cents: body.price_cents,
    ...(body.currency ? { currency: body.currency } : {}),
    ...(body.buffer_before_minutes !== undefined ? { buffer_before_minutes: body.buffer_before_minutes } : {}),
    ...(body.buffer_after_minutes !== undefined ? { buffer_after_minutes: body.buffer_after_minutes } : {}),
    ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
  };

  const { data: existing } = await ctx.db
    .from("services")
    .select("id")
    .eq("business_id", ctx.businessId)
    .eq("external_id", externalId.data)
    .maybeSingle();

  let serviceId = existing?.id;
  if (serviceId) {
    const { error } = await ctx.db.from("services").update(fields).eq("id", serviceId);
    if (error) return fail(422, "invalid_request", "The service could not be saved.");
  } else {
    const { data: created, error } = await ctx.db
      .from("services")
      .insert({ ...fields, business_id: ctx.businessId, external_id: externalId.data })
      .select("id")
      .single();
    if (error || !created) return fail(422, "invalid_request", "The service could not be saved.");
    serviceId = created.id;

    // A new service nobody can perform would never appear as bookable.
    if (!staffIds) {
      const { data: bookable } = await ctx.db
        .from("staff_profiles")
        .select("id")
        .eq("business_id", ctx.businessId)
        .eq("is_bookable", true);
      staffIds = (bookable ?? []).map((s) => s.id);
    }
  }

  if (staffIds) {
    await ctx.db.from("service_staff").delete().eq("service_id", serviceId);
    if (staffIds.length) {
      await ctx.db
        .from("service_staff")
        .insert(staffIds.map((id) => ({ service_id: serviceId, staff_profile_id: id })));
    }
  }

  await revalidatePublicSurfaces(ctx.businessId).catch(() => undefined);

  return ok({ id: serviceId, external_id: externalId.data, created: !existing }, existing ? 200 : 201);
}
