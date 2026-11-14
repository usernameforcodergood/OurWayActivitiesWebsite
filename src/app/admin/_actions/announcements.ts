"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cms/public";
import { announcementSchema, issuesToFields, type ActionResult, type AnnouncementInput } from "@/lib/cms/schemas";

export async function saveAnnouncement(input: AnnouncementInput): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation", fieldErrors: issuesToFields(parsed.error.issues) };
  }
  const { id, ...row } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const query = id
    ? supabase.from("announcements").update(row).eq("id", id).select("id, slug").single()
    : supabase.from("announcements").insert(row).select("id, slug").single();
  const { data, error } = await query;
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "validation", fieldErrors: { slug: "slugTaken" } };
    console.error("[admin] saveAnnouncement:", error?.message);
    return { ok: false, error: "generic" };
  }
  updateTag(TAGS.announcements);
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function setAnnouncementStatus(id: string, status: "draft" | "published"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  if (status === "published") {
    const { data: row } = await supabase
      .from("announcements")
      .select("title_el, title_en, summary_el, summary_en")
      .eq("id", id)
      .maybeSingle();
    if (!row) return { ok: false, error: "generic" };
    const complete = (row.title_el && row.summary_el) || (row.title_en && row.summary_en);
    if (!complete) return { ok: false, error: "publishNeedsLanguage" };
  }
  const { error } = await supabase.from("announcements").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "generic" };
  updateTag(TAGS.announcements);
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("announcements").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: "generic" };
  updateTag(TAGS.announcements);
  return { ok: true };
}
