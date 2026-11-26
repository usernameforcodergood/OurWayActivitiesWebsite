"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cms/public";
import { issuesToFields, journeySchema, type ActionResult, type JourneyInput } from "@/lib/cms/schemas";
import { cleanRichText } from "@/lib/cms/richTextSanitize";
import { athensToday } from "@/lib/bookings/validation";

/**
 * "Our Journeys" — create / edit / publish / withdraw / delete an archive entry.
 * Only journeys and journey_images are written: the excursion, its runs,
 * bookings and payments are read for checks and never changed.
 */

const missingTable = (msg: string | undefined) => Boolean(msg && /journey/.test(msg) && /does not exist|schema cache/.test(msg));

export async function saveJourney(input: JourneyInput): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = journeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issuesToFields(parsed.error.issues) };
  const { id, gallery, ...fields } = parsed.data;
  fields.description_el = cleanRichText(fields.description_el);
  fields.description_en = cleanRichText(fields.description_en);
  const db = await createSupabaseServerClient();
  const today = athensToday();

  // The run must belong to this excursion, must have taken place and must not be cancelled.
  if (fields.departure_id) {
    const { data: dep } = await db
      .from("departures")
      .select("excursion_id, departure_date, status")
      .eq("id", fields.departure_id)
      .maybeSingle();
    if (!dep || dep.excursion_id !== fields.excursion_id) {
      return { ok: false, error: "validation", fieldErrors: { departure_id: "departureMismatch" } };
    }
    if (dep.status === "cancelled") return { ok: false, error: "validation", fieldErrors: { departure_id: "departureCancelled" } };
    if (dep.departure_date > today) return { ok: false, error: "validation", fieldErrors: { departure_id: "departureNotYet" } };
  }
  if (fields.occurred_on > today) return { ok: false, error: "validation", fieldErrors: { occurred_on: "dateFuture" } };

  let publishedAt: string | null | undefined;
  if (fields.status === "published") {
    const current = id ? (await db.from("journeys").select("published_at").eq("id", id).maybeSingle()).data : null;
    publishedAt = current?.published_at ?? new Date().toISOString();
  }
  // The cover is always one of the entry's photos (or none: the first photo is used).
  const cover = fields.cover_media_id && gallery.includes(fields.cover_media_id) ? fields.cover_media_id : null;
  const row = { ...fields, cover_media_id: cover, ...(publishedAt !== undefined ? { published_at: publishedAt } : {}) };

  const { data, error } = id
    ? await db.from("journeys").update(row).eq("id", id).select("id, slug").single()
    : await db.from("journeys").insert(row).select("id, slug").single();
  if (error || !data) {
    if (error?.code === "23505") {
      const field: Record<string, string> = /departure/.test(error.message) ? { departure_id: "departureTaken" } : { slug: "slugTaken" };
      return { ok: false, error: "validation", fieldErrors: field };
    }
    if (error?.code === "23514" && /consent/.test(error.message)) {
      return { ok: false, error: "validation", fieldErrors: { photo_consent_confirmed: "consentRequired" } };
    }
    if (missingTable(error?.message)) return { ok: false, error: "notMigrated" };
    console.error("[admin] saveJourney:", error?.code, error?.message);
    return { ok: false, error: "generic" };
  }

  // Replace the gallery in order.
  const del = await db.from("journey_images").delete().eq("journey_id", data.id);
  if (del.error) return { ok: false, error: "generic" };
  if (gallery.length) {
    const ins = await db.from("journey_images").insert(gallery.map((media_id, position) => ({ journey_id: data.id, media_id, position })));
    if (ins.error) {
      console.error("[admin] journey gallery:", ins.error.message);
      return { ok: false, error: "generic" };
    }
  }
  updateTag(TAGS.journeys);
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function setJourneyStatus(id: string, status: "draft" | "published"): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { status };
  if (status === "published") {
    const { data: row } = await db
      .from("journeys")
      .select("title_el, title_en, summary_el, summary_en, photo_consent_confirmed, published_at")
      .eq("id", id)
      .maybeSingle();
    if (!row) return { ok: false, error: "generic" };
    const complete = (row.title_el && row.summary_el) || (row.title_en && row.summary_en);
    if (!complete) return { ok: false, error: "publishNeedsLanguage" };
    if (!row.photo_consent_confirmed) return { ok: false, error: "consentRequired" };
    if (!row.published_at) patch.published_at = new Date().toISOString();
  }
  const { error } = await db.from("journeys").update(patch).eq("id", id);
  if (error) return { ok: false, error: "generic" };
  updateTag(TAGS.journeys);
  return { ok: true };
}

/** Removes the archive entry only (its photos stay in the media library). */
export async function deleteJourney(id: string): Promise<ActionResult> {
  await requireAdmin();
  const db = await createSupabaseServerClient();
  const { error, count } = await db.from("journeys").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: "generic" };
  updateTag(TAGS.journeys);
  return { ok: true };
}
