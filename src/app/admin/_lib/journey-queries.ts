import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { athensToday } from "@/lib/bookings/validation";
import type { JourneyRow } from "@/lib/cms/types";
import { ilikePattern, type ListParams } from "../_components/ListToolbar";
import { PAGE_SIZE } from "./queries";

const JOURNEY_FULL =
  "*, cover:media!journeys_cover_media_id_fkey(*), images:journey_images(position, media(*)), excursion:excursions(slug, primary_category, destination_el, destination_en, title_el, title_en)";

export type AdminJourneyRow = JourneyRow & {
  excursion?: (NonNullable<JourneyRow["excursion"]> & { title_el: string | null; title_en: string | null }) | null;
};

/** List for /admin/journeys. `missing` = migration 0014 not applied yet. */
export async function listJourneys(p: ListParams) {
  const db = await createSupabaseServerClient();
  let q = db.from("journeys").select(JOURNEY_FULL, { count: "exact" });
  if (p.status !== "all") q = q.eq("status", p.status);
  if (p.q) {
    const pat = ilikePattern(p.q);
    q = q.or(`title_el.ilike.${pat},title_en.ilike.${pat},slug.ilike.${pat},location_el.ilike.${pat}`);
  }
  if (p.sort === "title") q = q.order("title_el", { ascending: true, nullsFirst: false });
  else if (p.sort === "created") q = q.order("created_at", { ascending: false });
  else q = q.order("occurred_on", { ascending: false });
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) console.error("[admin] list journeys:", error.message);
  return {
    rows: (data ?? []) as unknown as AdminJourneyRow[],
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    missing: Boolean(error && /does not exist|schema cache/.test(error.message)),
  };
}

export async function getJourneyById(id: string): Promise<AdminJourneyRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createSupabaseServerClient();
  const { data } = await db.from("journeys").select(JOURNEY_FULL).eq("id", id).maybeSingle();
  return (data as unknown as AdminJourneyRow | null) ?? null;
}

export type JourneyExcursionOption = {
  id: string;
  title_el: string | null;
  title_en: string | null;
  summary_el: string | null;
  summary_en: string | null;
  destination_el: string | null;
  destination_en: string | null;
  status: "draft" | "published";
};
export type JourneyDepartureOption = {
  id: string;
  excursion_id: string;
  departure_date: string;
  return_date: string | null;
  departure_time: string | null;
  status: string;
  /** Another archive entry already documents this run. */
  takenBy: string | null;
};

/**
 * Choices for the form: every excursion, and its runs that have already taken
 * place (not cancelled), newest first. Only dates and statuses are read — no
 * booking or participant data.
 */
export async function getJourneyOptions(): Promise<{ excursions: JourneyExcursionOption[]; departures: JourneyDepartureOption[] }> {
  const db = await createSupabaseServerClient();
  const today = athensToday();
  const [ex, deps, used] = await Promise.all([
    db
      .from("excursions")
      .select("id, title_el, title_en, summary_el, summary_en, destination_el, destination_en, status")
      .order("title_el", { ascending: true, nullsFirst: false }),
    db
      .from("departures")
      .select("id, excursion_id, departure_date, return_date, departure_time, status")
      .lte("departure_date", today)
      .neq("status", "cancelled")
      .order("departure_date", { ascending: false })
      .limit(1000),
    db.from("journeys").select("id, departure_id").not("departure_id", "is", null),
  ]);
  const taken = new Map(((used.data ?? []) as Array<{ id: string; departure_id: string }>).map((r) => [r.departure_id, r.id]));
  return {
    excursions: (ex.data ?? []) as JourneyExcursionOption[],
    departures: ((deps.data ?? []) as Omit<JourneyDepartureOption, "takenBy">[]).map((d) => ({ ...d, takenBy: taken.get(d.id) ?? null })),
  };
}
