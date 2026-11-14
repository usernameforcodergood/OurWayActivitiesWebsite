import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import { getPublicSupabase } from "@/lib/supabase/public";
import { toPublicAnnouncement, toPublicExcursion } from "./mappers";
import type { AnnouncementRow, ExcursionRow, PublicAnnouncement, PublicExcursion, SiteSettingsRow } from "./types";

/**
 * Cached, read-only queries for the public website. Each is tagged so the
 * admin's save/publish actions can expire it instantly (see TAGS).
 * RLS guarantees only published / active content is ever returned.
 */
export const TAGS = {
  excursions: "cms:excursions",
  announcements: "cms:announcements",
  settings: "cms:settings",
} as const;

const EXCURSION_SELECT =
  "*, cover:media!excursions_cover_media_id_fkey(*), images:excursion_images(position, media(*))";
const ANNOUNCEMENT_SELECT = "*, image:media!announcements_image_media_id_fkey(*)";

function logError(scope: string, error: { message: string } | null) {
  if (error) console.error(`[cms] ${scope}: ${error.message}`);
}

/* ------------------------------ Excursions ------------------------------ */

async function fetchPublishedExcursionRows(): Promise<ExcursionRow[]> {
  "use cache";
  cacheTag(TAGS.excursions);
  cacheLife("hours");
  const db = getPublicSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("excursions")
    .select(EXCURSION_SELECT)
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  logError("excursions", error);
  return (data as ExcursionRow[] | null) ?? [];
}

/** Published excursions that are complete in `locale`. */
export async function getPublishedExcursions(locale: Locale): Promise<PublicExcursion[]> {
  const rows = await fetchPublishedExcursionRows();
  return rows.map((r) => toPublicExcursion(r, locale)).filter((e) => e.locales.includes(locale));
}

export async function getFeaturedExcursions(locale: Locale, limit = 3): Promise<PublicExcursion[]> {
  const all = await getPublishedExcursions(locale);
  const featured = all.filter((e) => e.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

/** Returns the excursion even if it is incomplete in `locale` (caller decides). */
export async function getPublishedExcursion(slug: string, locale: Locale): Promise<PublicExcursion | null> {
  const rows = await fetchPublishedExcursionRows();
  const row = rows.find((r) => r.slug === slug);
  return row ? toPublicExcursion(row, locale) : null;
}

export async function getPublishedExcursionSlugs(): Promise<string[]> {
  return (await fetchPublishedExcursionRows()).map((r) => r.slug);
}

/* ---------------------------- Announcements ----------------------------- */

async function fetchActiveAnnouncementRows(): Promise<AnnouncementRow[]> {
  "use cache";
  cacheTag(TAGS.announcements);
  // Short life: publish/expiry times are honoured within a few minutes even
  // without an admin action.
  cacheLife("minutes");
  const db = getPublicSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT)
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("publish_at", { ascending: false });
  logError("announcements", error);
  return (data as AnnouncementRow[] | null) ?? [];
}

export async function getActiveAnnouncements(locale: Locale, limit?: number): Promise<PublicAnnouncement[]> {
  const rows = await fetchActiveAnnouncementRows();
  const list = rows.map((r) => toPublicAnnouncement(r, locale)).filter((a) => a.locales.includes(locale));
  return limit ? list.slice(0, limit) : list;
}

export async function getActiveAnnouncement(slug: string, locale: Locale): Promise<PublicAnnouncement | null> {
  const row = (await fetchActiveAnnouncementRows()).find((r) => r.slug === slug);
  return row ? toPublicAnnouncement(row, locale) : null;
}

/* ------------------------------- Settings ------------------------------- */

export async function getSiteSettings(): Promise<SiteSettingsRow | null> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  const db = getPublicSupabase();
  if (!db) return null;
  const { data, error } = await db.from("site_settings").select("*").eq("id", 1).maybeSingle();
  logError("settings", error);
  return (data as SiteSettingsRow | null) ?? null;
}
