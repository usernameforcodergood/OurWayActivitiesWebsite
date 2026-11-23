import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ResolvedRange } from "./analytics-range";

/**
 * Analytics reads for the admin dashboard. Every call goes through an
 * analytics_* database function that checks is_admin() and returns
 * aggregates only; the raw event tables are never readable from here.
 */

export type Summary = {
  pageviews: number;
  visitors: number;
  new_visitors: number;
  returning_visitors: number;
  sessions: number;
  avg_session_seconds: number | null;
  pages_per_session: number | null;
  bounce_rate: number | null;
  conversions: number;
  first_session_at: string | null;
};
export type SeriesPoint = { bucket: string; pageviews: number; visitors: number; sessions: number };
export type PageRow = { path: string; title: string | null; views: number; visitors: number; avg_engaged_seconds: number | null; share: number | null; total_rows: number };
export type Behavior = {
  entry: { path: string; sessions: number }[];
  exit: { path: string; sessions: number }[];
  flows: { from_path: string; to_path: string; n: number }[];
};
export type Funnel = {
  entered: number;
  viewed_excursion: number;
  clicked_or_later: number;
  opened_form: number;
  started_form: number;
  submitted_ok: number;
  clicked_button: number;
  submit_attempts: number;
  had_failure: number;
};
export type ExcursionRow = { excursion_id: string; title: string; slug: string; views: number; visitors: number; clickers: number; conversions: number; all_requests: number };
export type SourceRow = { channel: string; source?: string | null; medium?: string | null; campaign?: string | null; sessions: number; visitors: number; conversions: number };
export type Sources = { channels: SourceRow[]; detail: SourceRow[] };
export type TechRow = { key: string; country?: string; sessions: number; visitors: number };
export type Tech = Record<"device" | "browser" | "os" | "screen" | "country" | "region" | "city", TechRow[]>;
export type Realtime = {
  window_minutes: number;
  active_visitors: number;
  active_sessions: number;
  pages: { path: string; title: string | null; n: number }[];
  excursions: { id: string; title: string; n: number }[];
  per_minute: { minute: string; n: number }[];
  recent: { at: string; name: string; path: string; excursion: string | null; device: string; country: string | null }[];
};

export type PageSort = "views" | "visitors" | "engagement" | "path";
export const PAGE_SIZE = 15;

export type AnalyticsData = {
  summary: Summary;
  prevSummary: Summary;
  series: SeriesPoint[];
  prevSeries: SeriesPoint[];
  pages: PageRow[];
  behavior: Behavior;
  funnel: Funnel;
  excursions: ExcursionRow[];
  sources: Sources;
  tech: Tech;
};

export class AnalyticsUnavailable extends Error {}

const num = (v: unknown) => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown) => (v == null ? null : Number(v));

function normSummary(raw: Record<string, unknown>): Summary {
  return {
    pageviews: num(raw.pageviews),
    visitors: num(raw.visitors),
    new_visitors: num(raw.new_visitors),
    returning_visitors: num(raw.returning_visitors),
    sessions: num(raw.sessions),
    avg_session_seconds: numOrNull(raw.avg_session_seconds),
    pages_per_session: numOrNull(raw.pages_per_session),
    bounce_rate: numOrNull(raw.bounce_rate),
    conversions: num(raw.conversions),
    first_session_at: (raw.first_session_at as string | null) ?? null,
  };
}

export async function getAnalytics(r: ResolvedRange, pages: { sort: PageSort; page: number }): Promise<AnalyticsData> {
  const db = await createSupabaseServerClient();
  const cur = { p_from: r.from, p_to: r.to };
  const prev = { p_from: r.prevFrom, p_to: r.prevTo };
  const results = await Promise.all([
    db.rpc("analytics_summary", cur),
    db.rpc("analytics_summary", prev),
    db.rpc("analytics_timeseries", { ...cur, p_bucket: r.bucket }),
    db.rpc("analytics_timeseries", { ...prev, p_bucket: r.bucket }),
    db.rpc("analytics_pages", { ...cur, p_sort: pages.sort, p_limit: PAGE_SIZE, p_offset: (pages.page - 1) * PAGE_SIZE }),
    db.rpc("analytics_behavior", cur),
    db.rpc("analytics_funnel", cur),
    db.rpc("analytics_excursions", { ...cur, p_limit: 20 }),
    db.rpc("analytics_sources", cur),
    db.rpc("analytics_tech", cur),
  ]);
  const failed = results.find((x) => x.error);
  if (failed?.error) {
    console.error("[analytics] report failed:", failed.error.code, failed.error.message);
    throw new AnalyticsUnavailable(failed.error.code === "PGRST202" || failed.error.code === "42883" ? "missing" : "error");
  }
  const [s, ps, ts, pts, pg, bh, fn, ex, src, tc] = results.map((x) => x.data);
  const series = (rows: unknown) =>
    ((rows as Record<string, unknown>[]) ?? []).map((p) => ({
      bucket: String(p.bucket),
      pageviews: num(p.pageviews),
      visitors: num(p.visitors),
      sessions: num(p.sessions),
    }));
  return {
    summary: normSummary(s as Record<string, unknown>),
    prevSummary: normSummary(ps as Record<string, unknown>),
    series: series(ts),
    prevSeries: series(pts),
    pages: ((pg as Record<string, unknown>[]) ?? []).map((p) => ({
      path: String(p.path),
      title: (p.title as string | null) ?? null,
      views: num(p.views),
      visitors: num(p.visitors),
      avg_engaged_seconds: numOrNull(p.avg_engaged_seconds),
      share: numOrNull(p.share),
      total_rows: num(p.total_rows),
    })),
    behavior: bh as Behavior,
    funnel: fn as Funnel,
    excursions: ((ex as Record<string, unknown>[]) ?? []).map((e) => ({
      excursion_id: String(e.excursion_id),
      title: String(e.title ?? ""),
      slug: String(e.slug ?? ""),
      views: num(e.views),
      visitors: num(e.visitors),
      clickers: num(e.clickers),
      conversions: num(e.conversions),
      all_requests: num(e.all_requests),
    })),
    sources: src as Sources,
    tech: tc as Tech,
  };
}

export async function getRealtime(): Promise<Realtime> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("analytics_realtime");
  if (error) throw new AnalyticsUnavailable(error.message);
  return data as Realtime;
}
