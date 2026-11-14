import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AnnouncementRow, ExcursionRow, MediaRow, SiteSettingsRow } from "@/lib/cms/types";
import { ilikePattern, type ListParams } from "../_components/ListToolbar";

/** Admin reads always use the admin's session (RLS: admins see drafts). */

export const PAGE_SIZE = 20;

/** Current time for request-time admin views (kept out of render for purity). */
export async function nowMs(): Promise<number> {
  return Date.now();
}
const EXCURSION_FULL =
  "*, cover:media!excursions_cover_media_id_fkey(*), images:excursion_images(position, media(*))";
const ANNOUNCEMENT_FULL = "*, image:media!announcements_image_media_id_fkey(*)";

type Sortable = "excursions" | "announcements";

async function list<T>(table: Sortable, select: string, p: ListParams) {
  const db = await createSupabaseServerClient();
  let q = db.from(table).select(select, { count: "exact" });
  if (p.status !== "all") q = q.eq("status", p.status);
  if (p.q) {
    const pat = ilikePattern(p.q);
    q = q.or(`title_el.ilike.${pat},title_en.ilike.${pat},slug.ilike.${pat}`);
  }
  if (p.sort === "title") q = q.order("title_el", { ascending: true, nullsFirst: false }).order("title_en");
  else q = q.order(p.sort === "created" ? "created_at" : "updated_at", { ascending: false });
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) console.error(`[admin] list ${table}:`, error.message);
  return { rows: (data ?? []) as T[], total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) };
}

export function listExcursions(p: ListParams) {
  return list<ExcursionRow>("excursions", "*, cover:media!excursions_cover_media_id_fkey(*)", p);
}

export function listAnnouncements(p: ListParams) {
  return list<AnnouncementRow>("announcements", ANNOUNCEMENT_FULL, p);
}

export async function getExcursionById(id: string): Promise<ExcursionRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db.from("excursions").select(EXCURSION_FULL).eq("id", id).maybeSingle();
  return (data as ExcursionRow | null) ?? null;
}

export async function getAnnouncementById(id: string): Promise<AnnouncementRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db.from("announcements").select(ANNOUNCEMENT_FULL).eq("id", id).maybeSingle();
  return (data as AnnouncementRow | null) ?? null;
}

export async function getDashboardData() {
  const db = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const count = async (table: Sortable, filter?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const q = filter ? filter(base(table)) : base(table);
    const { count: c } = await q;
    return c ?? 0;
  };
  function base(table: Sortable) {
    return db.from(table).select("id", { count: "exact", head: true });
  }
  const [total, published, drafts, annTotal, annActive, recentEx, recentAnn] = await Promise.all([
    count("excursions"),
    count("excursions", (q) => q.eq("status", "published")),
    count("excursions", (q) => q.eq("status", "draft")),
    count("announcements"),
    count("announcements", (q) =>
      q.eq("status", "published").lte("publish_at", nowIso).or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    ),
    db.from("excursions").select("id, title_el, title_en, slug, status, updated_at").order("updated_at", { ascending: false }).limit(6),
    db.from("announcements").select("id, title_el, title_en, slug, status, updated_at").order("updated_at", { ascending: false }).limit(6),
  ]);
  type Recent = { id: string; title_el: string | null; title_en: string | null; slug: string; status: "draft" | "published"; updated_at: string };
  const recent = [
    ...((recentEx.data ?? []) as Recent[]).map((r) => ({ ...r, kind: "excursion" as const })),
    ...((recentAnn.data ?? []) as Recent[]).map((r) => ({ ...r, kind: "announcement" as const })),
  ]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 8);
  return { total, published, drafts, annTotal, annActive, recent };
}

export async function getMediaWithUsage(): Promise<Array<MediaRow & { usage: number }>> {
  const db = await createSupabaseServerClient();
  const [{ data: media }, { data: covers }, { data: gallery }, { data: ann }] = await Promise.all([
    db.from("media").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("excursions").select("cover_media_id").not("cover_media_id", "is", null),
    db.from("excursion_images").select("media_id"),
    db.from("announcements").select("image_media_id").not("image_media_id", "is", null),
  ]);
  const usage = new Map<string, number>();
  const bump = (id: string | null) => id && usage.set(id, (usage.get(id) ?? 0) + 1);
  (covers ?? []).forEach((r) => bump(r.cover_media_id as string));
  (gallery ?? []).forEach((r) => bump(r.media_id as string));
  (ann ?? []).forEach((r) => bump(r.image_media_id as string));
  return ((media ?? []) as MediaRow[]).map((m) => ({ ...m, usage: usage.get(m.id) ?? 0 }));
}

export async function getSettingsAndAdmins(): Promise<{ settings: SiteSettingsRow | null; adminCount: number }> {
  const db = await createSupabaseServerClient();
  const [{ data }, { count }] = await Promise.all([
    db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("admin_users").select("user_id", { count: "exact", head: true }),
  ]);
  return { settings: (data as SiteSettingsRow | null) ?? null, adminCount: count ?? 0 };
}
