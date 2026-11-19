"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cms/public";
import { departureSchema, issuesToFields, type ActionResult, type DepartureInput } from "@/lib/cms/schemas";
import { athensInputToIso } from "../_lib/athens-time";

/** Create or update one departure. Capacity can never drop below places already held (DB trigger). */
export async function saveDeparture(input: DepartureInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = departureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issuesToFields(parsed.error.issues) };
  const { id, booking_deadline, ...fields } = parsed.data;
  const row = { ...fields, booking_deadline: booking_deadline ? athensInputToIso(booking_deadline) : null };
  const db = await createSupabaseServerClient();
  // A departure's own price may not be lower than the excursion's deposit.
  if (fields.price_eur != null) {
    const { data: ex } = await db.from("excursions").select("deposit_eur").eq("id", fields.excursion_id).maybeSingle();
    const deposit = ex?.deposit_eur == null ? null : Number(ex.deposit_eur);
    if (deposit != null && fields.price_eur < deposit) {
      return { ok: false, error: "validation", fieldErrors: { price_eur: "depositAboveDeparturePrice" } };
    }
  }
  const q = id
    ? db.from("departures").update(row).eq("id", id).eq("excursion_id", fields.excursion_id).select("id").single()
    : db.from("departures").insert(row).select("id").single();
  const { data, error } = await q;
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "duplicateSlot" };
    const held = /capacity_below_held:(\d+)/.exec(error?.message ?? "");
    if (held) return { ok: false, error: "capacityBelowHeld", fieldErrors: { capacity: `capacityBelowHeld:${held[1]}` } };
    console.error("[admin] saveDeparture:", error?.message);
    return { ok: false, error: "generic" };
  }
  updateTag(TAGS.excursions);
  return { ok: true, data: { id: data.id } };
}

export async function deleteDeparture(id: string): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSupabaseServerClient();
  const { error, count } = await db.from("departures").delete({ count: "exact" }).eq("id", id);
  if (error?.code === "23503") return { ok: false, error: "departureHasBookings" };
  if (error || !count) return { ok: false, error: "generic" };
  updateTag(TAGS.excursions);
  return { ok: true };
}
