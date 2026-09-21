"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  appointmentId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export type ReviewResult = { ok: true } | { ok: false; code: string };

/**
 * The RLS policy already requires the appointment to belong to the author;
 * this reads it first only to resolve `business_id` and to refuse a review of
 * a visit that has not happened, which is a product rule rather than a
 * security one.
 */
export async function submitReview(input: {
  appointmentId: string;
  rating: number;
  comment?: string;
}): Promise<ReviewResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "generic" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { ok: false, code: "unauthenticated" };

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, business_id, staff_profile_id, status, starts_at, customer_profile_id")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();

  if (!appointment || appointment.customer_profile_id !== userId) {
    return { ok: false, code: "generic" };
  }

  const hasHappened =
    appointment.status === "completed" ||
    (appointment.status === "confirmed" &&
      new Date(appointment.starts_at).getTime() < Date.now());

  if (!hasHappened) return { ok: false, code: "onlyAfterVisit" };

  const { error } = await supabase.from("reviews").insert({
    business_id: appointment.business_id,
    appointment_id: appointment.id,
    author_profile_id: userId,
    staff_profile_id: appointment.staff_profile_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment?.trim() || null,
  });

  if (error) {
    return { ok: false, code: error.code === "23505" ? "alreadyReviewed" : "generic" };
  }

  revalidatePath("/[locale]/bookings/[id]", "page");
  revalidatePath("/[locale]/reviews", "page");
  return { ok: true };
}
