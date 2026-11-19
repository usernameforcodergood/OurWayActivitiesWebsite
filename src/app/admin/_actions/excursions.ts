"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cms/public";
import { excursionSchema, issuesToFields, type ActionResult, type ExcursionInput } from "@/lib/cms/schemas";

/** Create or update an excursion (including its status and gallery). */
export async function saveExcursion(input: ExcursionInput): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = excursionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation", fieldErrors: issuesToFields(parsed.error.issues) };
  }
  const { id, gallery, ...fields } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // A run with its own price (and no own deposit) must not end up cheaper than this deposit.
  if (id && fields.deposit_eur != null) {
    const { data: priced } = await supabase
      .from("departures")
      .select("id")
      .eq("excursion_id", id)
      .is("deposit_eur", null)
      .not("price_eur", "is", null)
      .lt("price_eur", fields.deposit_eur)
      .limit(1);
    if (priced?.length) return { ok: false, error: "validation", fieldErrors: { deposit_eur: "depositAboveDeparturePrice" } };
  }
  // A run with its own deposit (and no own price) must stay within this base price.
  if (id && fields.price_eur != null) {
    const { data: deposits } = await supabase
      .from("departures")
      .select("id")
      .eq("excursion_id", id)
      .is("price_eur", null)
      .gt("deposit_eur", fields.price_eur)
      .limit(1);
    if (deposits?.length) return { ok: false, error: "validation", fieldErrors: { price_eur: "priceBelowDepartureDeposit" } };
  }

  let publishedAt: string | null | undefined;
  if (fields.status === "published") {
    if (id) {
      const { data: current } = await supabase.from("excursions").select("published_at").eq("id", id).maybeSingle();
      publishedAt = current?.published_at ?? new Date().toISOString();
    } else {
      publishedAt = new Date().toISOString();
    }
  }
  const row = { ...fields, ...(publishedAt !== undefined ? { published_at: publishedAt } : {}) };

  const query = id
    ? supabase.from("excursions").update(row).eq("id", id).select("id, slug").single()
    : supabase.from("excursions").insert(row).select("id, slug").single();
  const { data, error } = await query;

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "validation", fieldErrors: { slug: "slugTaken" } };
    console.error("[admin] saveExcursion:", error?.message);
    return { ok: false, error: "generic" };
  }

  // Replace the gallery in order.
  const del = await supabase.from("excursion_images").delete().eq("excursion_id", data.id);
  if (del.error) return { ok: false, error: "generic" };
  if (gallery.length) {
    const ins = await supabase
      .from("excursion_images")
      .insert(gallery.map((media_id, position) => ({ excursion_id: data.id, media_id, position })));
    if (ins.error) {
      console.error("[admin] gallery:", ins.error.message);
      return { ok: false, error: "generic" };
    }
  }

  updateTag(TAGS.excursions);
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

/** Quick publish / unpublish from the list view. */
export async function setExcursionStatus(id: string, status: "draft" | "published"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  if (status === "published") {
    const { data: row } = await supabase
      .from("excursions")
      .select("title_el, title_en, summary_el, summary_en, published_at, kind, primary_category")
      .eq("id", id)
      .maybeSingle();
    if (!row) return { ok: false, error: "generic" };
    const complete = (row.title_el && row.summary_el) || (row.title_en && row.summary_en);
    if (!complete) return { ok: false, error: "publishNeedsLanguage" };
    if (row.kind === "excursion" && !row.primary_category) return { ok: false, error: "categoryRequired" };
    const { error } = await supabase
      .from("excursions")
      .update({ status, published_at: row.published_at ?? new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: "generic" };
  } else {
    const { error } = await supabase.from("excursions").update({ status }).eq("id", id);
    if (error) return { ok: false, error: "generic" };
  }
  updateTag(TAGS.excursions);
  return { ok: true };
}

export async function deleteExcursion(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase.from("excursions").delete({ count: "exact" }).eq("id", id);
  // Booking requests keep their excursion (history must survive): unpublish instead.
  if (error?.code === "23503") return { ok: false, error: "hasBookings" };
  if (error || !count) return { ok: false, error: "generic" };
  updateTag(TAGS.excursions);
  return { ok: true };
}
