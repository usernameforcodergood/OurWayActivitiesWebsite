import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DepartureStatus } from "@/lib/cms/types";
import { getDepartureStats } from "./booking-queries";

/**
 * Admin calendar of scheduled runs (departures). Dates are plain YYYY-MM-DD
 * strings in Greek local time; arithmetic is done on UTC midnights so the
 * server timezone never shifts a day.
 */

export type CalendarView = "month" | "week";

export type CalendarRun = {
  id: string;
  excursionId: string;
  title: string;
  kind: "excursion" | "event";
  start: string;
  end: string;
  time: string | null;
  status: DepartureStatus;
  /** Visual state: upcoming (open/full), started/completed, or cancelled. */
  phase: "upcoming" | "full" | "done" | "cancelled";
  capacity: number | null;
  confirmed: number;
  pending: number;
};

export type CalendarTemplate = { id: string; title: string; status: "draft" | "published" };

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const addDays = (iso: string, n: number) => new Date(ms(iso) + n * DAY).toISOString().slice(0, 10);
/** 0 = Monday … 6 = Sunday (Greek week). */
export const weekday = (iso: string) => (new Date(ms(iso)).getUTCDay() + 6) % 7;
export const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(ms(v));

export function calendarRange(view: CalendarView, anchor: string) {
  if (view === "week") {
    const start = addDays(anchor, -weekday(anchor));
    return { start, end: addDays(start, 6), prev: addDays(start, -7), next: addDays(start, 7) };
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const start = addDays(first, -weekday(first));
  const d = new Date(ms(first));
  const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const prevMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const lastOfMonth = addDays(nextMonth, -1);
  const end = addDays(lastOfMonth, 6 - weekday(lastOfMonth));
  return { start, end, prev: prevMonth, next: nextMonth, first };
}

type Joined = {
  id: string;
  excursion_id: string;
  departure_date: string;
  return_date: string | null;
  departure_time: string | null;
  status: DepartureStatus;
  capacity: number | null;
  excursion: { title_el: string | null; title_en: string | null; kind: "excursion" | "event" } | null;
};

const SELECT = "id, excursion_id, departure_date, return_date, departure_time, status, capacity, excursion:excursions(title_el, title_en, kind)";

function toRuns(rows: Joined[], today: string, stats: Awaited<ReturnType<typeof getDepartureStats>>): CalendarRun[] {
  return rows.map((r) => {
    const s = stats.get(r.id);
    const phase: CalendarRun["phase"] =
      r.status === "cancelled" ? "cancelled"
      : r.status === "completed" || r.departure_date <= today ? "done"
      : r.status === "full" || (r.capacity != null && (s?.confirmed ?? 0) + (s?.pending_held ?? 0) >= r.capacity) ? "full"
      : "upcoming";
    return {
      id: r.id,
      excursionId: r.excursion_id,
      title: r.excursion?.title_el || r.excursion?.title_en || "—",
      kind: r.excursion?.kind ?? "excursion",
      start: r.departure_date,
      end: r.return_date && r.return_date > r.departure_date ? r.return_date : r.departure_date,
      time: r.departure_time?.slice(0, 5) ?? null,
      status: r.status,
      phase,
      capacity: r.capacity,
      confirmed: s?.confirmed ?? 0,
      pending: s?.pending_held ?? 0,
    };
  });
}

/** Runs overlapping [start, end], the next upcoming runs, and the excursions that can be repeated. */
export async function getCalendarData(start: string, end: string, today: string) {
  const db = await createSupabaseServerClient();
  const lookback = addDays(start, -60); // multi-day runs that began before the grid
  const [inRange, upcoming, templates] = await Promise.all([
    db.from("departures").select(SELECT).gte("departure_date", lookback).lte("departure_date", end).order("departure_date").order("departure_time").limit(1000),
    db
      .from("departures")
      .select(SELECT)
      .gt("departure_date", today)
      .in("status", ["open", "full"])
      .order("departure_date")
      .order("departure_time")
      .limit(8),
    db.from("excursions").select("id, title_el, title_en, status").eq("booking_mode", "departures").order("title_el").limit(500),
  ]);
  for (const r of [inRange, upcoming, templates]) if (r.error) console.error("[admin] calendar:", r.error.message);

  const rangeRows = ((inRange.data ?? []) as unknown as Joined[]).filter((r) => (r.return_date ?? r.departure_date) >= start);
  const upRows = (upcoming.data ?? []) as unknown as Joined[];
  const stats = await getDepartureStats([...new Set([...rangeRows, ...upRows].map((r) => r.id))]);

  return {
    runs: toRuns(rangeRows, today, stats),
    upcoming: toRuns(upRows, today, stats),
    templates: ((templates.data ?? []) as Array<{ id: string; title_el: string | null; title_en: string | null; status: "draft" | "published" }>).map(
      (e): CalendarTemplate => ({ id: e.id, title: e.title_el || e.title_en || "—", status: e.status }),
    ),
  };
}
