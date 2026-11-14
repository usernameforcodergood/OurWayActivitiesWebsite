"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/supabase/config";
import { TAGS } from "@/lib/cms/public";
import { mediaRecordSchema, type ActionResult, type MediaRecordInput } from "@/lib/cms/schemas";
import type { MediaRow } from "@/lib/cms/types";

/** Media library listing for the image pickers (newest first). */
export async function listMedia(): Promise<ActionResult<MediaRow[]>> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) return { ok: false, error: "generic" };
  return { ok: true, data: (data ?? []) as MediaRow[] };
}

/** Registers a file the admin's browser has just uploaded to Storage. */
export async function createMediaRecord(input: MediaRecordInput): Promise<ActionResult<MediaRow>> {
  const admin = await requireAdmin();
  const parsed = mediaRecordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media")
    .insert({ ...parsed.data, created_by: admin.id })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[admin] createMediaRecord:", error?.message);
    // Don't leave an orphaned file behind.
    await supabase.storage.from(MEDIA_BUCKET).remove([parsed.data.path]);
    return { ok: false, error: "generic" };
  }
  return { ok: true, data: data as MediaRow };
}

export async function updateMediaAlt(id: string, alt_el: string, alt_en: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const clean = (v: string) => (v.trim() ? v.trim().slice(0, 300) : null);
  const { error } = await supabase.from("media").update({ alt_el: clean(alt_el), alt_en: clean(alt_en) }).eq("id", id);
  if (error) return { ok: false, error: "generic" };
  updateTag(TAGS.excursions);
  updateTag(TAGS.announcements);
  return { ok: true };
}

/** Deletes the file and its record. References are cleared by FK rules. */
export async function deleteMedia(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase.from("media").select("path").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "generic" };
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) return { ok: false, error: "generic" };
  const removed = await supabase.storage.from(MEDIA_BUCKET).remove([row.path]);
  if (removed.error) console.error("[admin] storage remove:", removed.error.message);
  updateTag(TAGS.excursions);
  updateTag(TAGS.announcements);
  return { ok: true };
}
