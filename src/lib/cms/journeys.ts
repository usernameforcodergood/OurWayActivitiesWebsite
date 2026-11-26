import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import { getPublicSupabase } from "@/lib/supabase/public";
import { availableLocales, toImage } from "./mappers";
import { TAGS } from "./public";
import type { CmsImage, JourneyRow, PublicJourney } from "./types";

/**
 * "Our Journeys": published write-ups of completed runs. Read with the public
 * (anon) client, so RLS returns published entries only. Only content columns
 * are selected; the table has no participant or booking data at all.
 */
const JOURNEY_SELECT =
  "id, slug, status, title_el, title_en, summary_el, summary_en, description_el, description_en, quote_el, quote_en, location_el, location_en, occurred_on, occurred_until, cover:media!journeys_cover_media_id_fkey(*), images:journey_images(position, media(*)), excursion:excursions(slug, primary_category, destination_el, destination_en)";

const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : undefined);

async function fetchPublishedJourneyRows(): Promise<JourneyRow[]> {
  "use cache";
  cacheTag(TAGS.journeys, TAGS.excursions);
  cacheLife("hours");
  const db = getPublicSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("journeys")
    .select(JOURNEY_SELECT)
    .eq("status", "published")
    .order("occurred_on", { ascending: false });
  // Before migration 0014 the table does not exist: the archive simply stays empty.
  if (error) console.error(`[cms] journeys: ${error.message}`);
  return (data as unknown as JourneyRow[] | null) ?? [];
}

export function toPublicJourney(row: JourneyRow, locale: Locale): PublicJourney {
  const other: Locale = locale === "el" ? "en" : "el";
  const title = text(row[`title_${locale}`]) ?? text(row[`title_${other}`]) ?? "";
  const gallery = (row.images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => toImage(i.media, locale, title))
    .filter((i): i is CmsImage => i !== null);
  const ex = row.excursion ?? null;
  return {
    id: row.id,
    slug: row.slug,
    locales: availableLocales(row),
    title,
    summary: text(row[`summary_${locale}`]) ?? "",
    description: text(row[`description_${locale}`]) ?? "",
    quote: text(row[`quote_${locale}`]),
    location: text(row[`location_${locale}`]) ?? text(ex?.[`destination_${locale}`]),
    date: row.occurred_on,
    dateUntil: row.occurred_until && row.occurred_until !== row.occurred_on ? row.occurred_until : null,
    year: Number(row.occurred_on.slice(0, 4)),
    category: ex?.primary_category ?? null,
    excursionSlug: ex?.slug ?? null,
    cover: toImage(row.cover, locale, title) ?? gallery[0] ?? null,
    gallery,
  };
}

/** Published journeys complete in `locale`, most recent first. */
export async function getPublishedJourneys(locale: Locale): Promise<PublicJourney[]> {
  const rows = await fetchPublishedJourneyRows();
  return rows.map((r) => toPublicJourney(r, locale)).filter((j) => j.locales.includes(locale));
}

/** Returns the journey even if it is incomplete in `locale` (caller decides). */
export async function getPublishedJourney(slug: string, locale: Locale): Promise<PublicJourney | null> {
  const row = (await fetchPublishedJourneyRows()).find((r) => r.slug === slug);
  return row ? toPublicJourney(row, locale) : null;
}

export async function getPublishedJourneySlugs(): Promise<string[]> {
  return (await fetchPublishedJourneyRows()).map((r) => r.slug);
}
