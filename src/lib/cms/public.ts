import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import { getPublicSupabase } from "@/lib/supabase/public";
import { availableDays, toPublicAnnouncement, toPublicExcursion, type DepartureAvailabilityRow } from "./mappers";
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
  /** Live places on runs (changes with every request and admin decision). */
  availability: "cms:availability",
  journeys: "cms:journeys",
} as const;

const EXCURSION_SELECT =
  "*, cover:media!excursions_cover_media_id_fkey(*), images:excursion_images(position, media(*)), departures(*)";
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

/** A run still ahead: its start date has not arrived (Athens) and it is not archived/cancelled. */
export const isUpcomingRun = (d: PublicExcursion["departures"][number], today: string) =>
  d.date > today && d.status !== "cancelled" && d.status !== "completed";

/**
 * Scheduled excursions whose every run has started are archived: they leave
 * the public lists (their page and all requests stay). Excursions without any
 * run yet, and general experiences, stay listed. Filtering by date here means
 * this holds even before the database job marks the runs "completed".
 */
function isListed(e: PublicExcursion, today: string): boolean {
  if (e.bookingMode !== "departures" || e.departures.length === 0) return true;
  return e.departures.some((d) => isUpcomingRun(d, today));
}

/**
 * Dates a visitor can still request, per excursion: the same live availability
 * the booking form uses (public_departures(): only "open" runs, so cancelled,
 * completed, started, past-deadline and full runs — by status or by places
 * held — are excluded). Unique days, soonest first. An excursion whose lookup
 * failed is left out (unknown), never shown as "no dates".
 * Cached for minutes; new requests and admin decisions expire it sooner.
 */
async function fetchAvailableDates(excursionIds: string[]): Promise<Record<string, string[]>> {
  "use cache";
  cacheTag(TAGS.excursions, TAGS.availability);
  cacheLife("minutes");
  const db = getPublicSupabase();
  if (!db || excursionIds.length === 0) return {};
  const results = await Promise.all(
    excursionIds.map(async (id) => {
      const { data, error } = await db.rpc("public_departures", { p_excursion_id: id });
      logError(`availability ${id}`, error);
      if (error) return null;
      return [id, availableDays((data ?? []) as DepartureAvailabilityRow[])] as const;
    }),
  );
  return Object.fromEntries(results.filter((r): r is readonly [string, string[]] => r !== null));
}

/** Published excursions that are complete in `locale` and not archived, with their available dates. */
export async function getPublishedExcursions(locale: Locale): Promise<PublicExcursion[]> {
  const [rows, today] = await Promise.all([fetchPublishedExcursionRows(), athensToday()]);
  const list = rows.map((r) => toPublicExcursion(r, locale)).filter((e) => e.locales.includes(locale) && isListed(e, today));
  // Only scheduled excursions with a run still ahead need a live lookup.
  const scheduled = new Set(
    list.filter((e) => e.bookingMode === "departures" && e.departures.some((d) => isUpcomingRun(d, today))).map((e) => e.id),
  );
  const dates = await fetchAvailableDates([...scheduled].sort());
  return list.map((e) => {
    if (e.bookingMode === "none") return e;
    if (!scheduled.has(e.id)) return { ...e, availableDates: [] };
    return dates[e.id] === undefined ? e : { ...e, availableDates: dates[e.id] };
  });
}

/**
 * "Next experiences" on the homepage: excursions with an available run come
 * first, soonest first; then featured ones; then the rest (newest first).
 */
export async function getFeaturedExcursions(locale: Locale, limit = 3): Promise<PublicExcursion[]> {
  const all = (await getPublishedExcursions(locale)).filter((e) => e.kind === "excursion");
  const next = (e: PublicExcursion) => e.availableDates?.[0];
  return all
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const na = next(a.e);
      const nb = next(b.e);
      if (na && nb) return na.localeCompare(nb) || a.i - b.i;
      if (na || nb) return na ? -1 : 1;
      if (a.e.featured !== b.e.featured) return a.e.featured ? -1 : 1;
      return a.i - b.i;
    })
    .slice(0, limit)
    .map(({ e }) => e);
}

/**
 * Published events, soonest upcoming departure first; events without dates
 * (announced / dates to be set) follow, newest first.
 */
export async function getUpcomingEvents(locale: Locale, limit = 3): Promise<{ items: PublicExcursion[]; today: string }> {
  const today = await athensToday();
  const events = (await getPublishedExcursions(locale)).filter((e) => e.kind === "event");
  const next = (e: PublicExcursion) => e.departures.find((d) => isUpcomingRun(d, today))?.date;
  // Events whose every date has passed are not "upcoming".
  const live = events.filter((e) => next(e) || e.departures.length === 0);
  const items = live
    .sort((a, b) => {
      const na = next(a), nb = next(b);
      if (na && nb) return na.localeCompare(nb);
      if (na) return -1;
      if (nb) return 1;
      return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    })
    .slice(0, limit);
  return { items, today };
}

/** Today's date in Greece (YYYY-MM-DD), refreshed hourly. */
export async function athensToday(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
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
