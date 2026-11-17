import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DepartureRow } from "@/lib/cms/types";
import { BOOKING_STATUSES, PRIVATE_STATUSES, type BookingStatus, type PrivateStatus } from "@/lib/bookings/validation";
import { ilikePattern } from "../_components/ListToolbar";
import { PAGE_SIZE } from "./queries";

/** Admin reads use the admin's session; RLS hides everything from anyone else. */

export type BookingOverviewRow = {
  id: string;
  reference: string;
  kind: "booking" | "interest";
  status: BookingStatus;
  excursion_id: string;
  departure_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  participants: number;
  unit_price_eur: string | number | null;
  total_eur: string | number | null;
  locale: "el" | "en";
  hold_expires_at: string | null;
  status_changed_at: string;
  created_at: string;
  departure_date: string | null;
  departure_time: string | null;
  excursion_title_el: string | null;
  excursion_title_en: string | null;
  excursion_slug: string;
  excursion_kind: "excursion" | "event";
};

export type BookingDetail = BookingOverviewRow & {
  message: string | null;
  special_requests: string | null;
  consent_at: string;
  departure: Pick<DepartureRow, "id" | "capacity" | "status" | "booking_deadline"> | null;
};

export type HistoryRow = { id: number; from_status: string | null; to_status: string; note: string | null; changed_by: string | null; created_at: string };
export type NoteRow = { id: number; body: string; author_id: string | null; created_at: string };
export type EmailRow = { id: number; kind: string; recipient: string; status: "sent" | "failed" | "not_configured"; error: string | null; created_at: string };

export type BookingListParams = {
  q: string;
  status: "all" | BookingStatus;
  excursion: string;
  from: string;
  to: string;
  sort: "submitted" | "submitted_asc" | "departure";
  page: number;
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export function parseBookingParams(sp: Record<string, string | string[] | undefined>): BookingListParams {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = one("status");
  const sort = one("sort");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").slice(0, 100),
    status: (BOOKING_STATUSES as readonly string[]).includes(status) ? (status as BookingStatus) : "all",
    excursion: isUuid(one("excursion")) ? one("excursion") : "",
    from: isDate(one("from")) ? one("from") : "",
    to: isDate(one("to")) ? one("to") : "",
    sort: sort === "submitted_asc" || sort === "departure" ? sort : "submitted",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listBookings(p: BookingListParams) {
  const db = await createSupabaseServerClient();
  let q = db.from("booking_overview").select("*", { count: "exact" });
  if (p.status !== "all") q = q.eq("status", p.status);
  if (p.excursion) q = q.eq("excursion_id", p.excursion);
  if (p.from) q = q.gte("departure_date", p.from);
  if (p.to) q = q.lte("departure_date", p.to);
  if (p.q) {
    const pat = ilikePattern(p.q);
    q = q.or(`full_name.ilike.${pat},email.ilike.${pat},reference.ilike.${pat},phone.ilike.${pat}`);
  }
  if (p.sort === "departure") q = q.order("departure_date", { ascending: true, nullsFirst: false }).order("departure_time", { ascending: true });
  else q = q.order("created_at", { ascending: p.sort === "submitted_asc" });
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) console.error("[admin] list bookings:", error.message);
  return { rows: (data ?? []) as BookingOverviewRow[], total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) };
}

/** Excursions for the filter dropdown. */
export async function listExcursionOptions() {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("excursions").select("id, title_el, title_en, slug").order("updated_at", { ascending: false }).limit(300);
  return (data ?? []) as Array<{ id: string; title_el: string | null; title_en: string | null; slug: string }>;
}

export async function getBookingDetail(id: string) {
  if (!isUuid(id)) return null;
  const db = await createSupabaseServerClient();
  const [{ data: overview }, { data: extra }, { data: history }, { data: notes }, { data: emails }] = await Promise.all([
    db.from("booking_overview").select("*").eq("id", id).maybeSingle(),
    db.from("bookings").select("message, special_requests, consent_at, departure:departures(id, capacity, status, booking_deadline)").eq("id", id).maybeSingle(),
    db.from("request_status_history").select("id, from_status, to_status, note, changed_by, created_at").eq("booking_id", id).order("created_at"),
    db.from("request_notes").select("id, body, author_id, created_at").eq("booking_id", id).order("created_at", { ascending: false }),
    db.from("email_notifications").select("id, kind, recipient, status, error, created_at").eq("booking_id", id).order("created_at", { ascending: false }),
  ]);
  if (!overview || !extra) return null;
  const booking = { ...(overview as BookingOverviewRow), ...(extra as unknown as Omit<BookingDetail, keyof BookingOverviewRow>) } as BookingDetail;
  return {
    booking,
    history: (history ?? []) as HistoryRow[],
    notes: (notes ?? []) as NoteRow[],
    emails: (emails ?? []) as EmailRow[],
  };
}

export type DepartureStats = { departure_id: string; confirmed: number; pending_held: number; pending_expired: number };

export async function getDepartureStats(ids: string[]): Promise<Map<string, DepartureStats>> {
  if (!ids.length) return new Map();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("admin_departure_stats", { p_ids: ids });
  if (error) console.error("[admin] departure stats:", error.message);
  return new Map(((data ?? []) as DepartureStats[]).map((s) => [s.departure_id, s]));
}

export async function getDeparturesWithStats(excursionId: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("departures").select("*").eq("excursion_id", excursionId).order("departure_date").order("departure_time");
  const rows = (data ?? []) as DepartureRow[];
  const stats = await getDepartureStats(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? { departure_id: r.id, confirmed: 0, pending_held: 0, pending_expired: 0 } }));
}

/* ----------------------------- Private requests ----------------------------- */

export type PrivateRequestRow = {
  id: string;
  reference: string;
  status: PrivateStatus;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  participants: number;
  destination: string | null;
  destination_flexible: boolean;
  excursion_type: string | null;
  date_from: string | null;
  date_to: string | null;
  dates_flexible: boolean;
  duration: string | null;
  difficulty: string | null;
  transport: string | null;
  activities: string | null;
  budget_per_person: string | null;
  message: string | null;
  locale: "el" | "en";
  proposal_itinerary: string | null;
  proposal_dates: string | null;
  proposal_price_eur: string | number | null;
  consent_at: string;
  status_changed_at: string;
  created_at: string;
};

const PRIVATE_COLS =
  "id, reference, status, first_name, last_name, email, phone, participants, destination, destination_flexible, excursion_type, date_from, date_to, dates_flexible, duration, difficulty, transport, activities, budget_per_person, message, locale, proposal_itinerary, proposal_dates, proposal_price_eur, consent_at, status_changed_at, created_at";

export type PrivateListParams = { q: string; status: "all" | PrivateStatus; page: number };

export function parsePrivateParams(sp: Record<string, string | string[] | undefined>): PrivateListParams {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = one("status");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").slice(0, 100),
    status: (PRIVATE_STATUSES as readonly string[]).includes(status) ? (status as PrivateStatus) : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listPrivateRequests(p: PrivateListParams) {
  const db = await createSupabaseServerClient();
  let q = db.from("private_requests").select(PRIVATE_COLS, { count: "exact" });
  if (p.status !== "all") q = q.eq("status", p.status);
  if (p.q) {
    const pat = ilikePattern(p.q);
    q = q.or(`first_name.ilike.${pat},last_name.ilike.${pat},email.ilike.${pat},reference.ilike.${pat},destination.ilike.${pat}`);
  }
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) console.error("[admin] list private requests:", error.message);
  return { rows: (data ?? []) as PrivateRequestRow[], total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) };
}

export async function getPrivateRequestDetail(id: string) {
  if (!isUuid(id)) return null;
  const db = await createSupabaseServerClient();
  const [{ data }, { data: history }, { data: notes }, { data: emails }] = await Promise.all([
    db.from("private_requests").select(PRIVATE_COLS).eq("id", id).maybeSingle(),
    db.from("request_status_history").select("id, from_status, to_status, note, changed_by, created_at").eq("private_request_id", id).order("created_at"),
    db.from("request_notes").select("id, body, author_id, created_at").eq("private_request_id", id).order("created_at", { ascending: false }),
    db.from("email_notifications").select("id, kind, recipient, status, error, created_at").eq("private_request_id", id).order("created_at", { ascending: false }),
  ]);
  if (!data) return null;
  return {
    request: data as PrivateRequestRow,
    history: (history ?? []) as HistoryRow[],
    notes: (notes ?? []) as NoteRow[],
    emails: (emails ?? []) as EmailRow[],
  };
}

/* --------------------------------- Dashboard -------------------------------- */

export async function getBookingDashboard(today: string) {
  const db = await createSupabaseServerClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [pending, confirmed, upcoming, recent, privNew, failures] = await Promise.all([
    db.from("bookings").select("participants").eq("status", "pending").limit(5000),
    db.from("bookings").select("participants").eq("status", "confirmed").limit(5000),
    db
      .from("departures")
      .select("id, departure_date, departure_time, capacity, status, excursion:excursions(id, title_el, title_en)")
      .gte("departure_date", today)
      .in("status", ["open", "full"])
      .order("departure_date")
      .limit(200),
    db.from("booking_overview").select("*").order("status_changed_at", { ascending: false }).limit(8),
    db.from("private_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
    db.from("email_notifications").select("id, kind, recipient, status, created_at, booking_id, private_request_id").neq("status", "sent").gte("created_at", since).order("created_at", { ascending: false }).limit(10),
  ]);
  const sum = (rows: Array<{ participants: number }> | null) => (rows ?? []).reduce((a, r) => a + r.participants, 0);
  type Up = { id: string; departure_date: string; departure_time: string | null; capacity: number | null; status: string; excursion: { id: string; title_el: string | null; title_en: string | null } | null };
  const ups = (upcoming.data ?? []) as unknown as Up[];
  const stats = await getDepartureStats(ups.map((u) => u.id));
  const full = ups
    .map((u) => {
      const s = stats.get(u.id);
      const held = (s?.confirmed ?? 0) + (s?.pending_held ?? 0);
      return { ...u, held, confirmed: s?.confirmed ?? 0 };
    })
    .filter((u) => u.status === "full" || (u.capacity != null && u.held >= u.capacity))
    .slice(0, 6);
  return {
    pendingCount: pending.data?.length ?? 0,
    pendingPeople: sum(pending.data),
    confirmedCount: confirmed.data?.length ?? 0,
    confirmedPeople: sum(confirmed.data),
    upcomingDepartures: ups.length,
    recent: (recent.data ?? []) as BookingOverviewRow[],
    newPrivate: privNew.count ?? 0,
    full,
    failures: (failures.data ?? []) as Array<EmailRow & { booking_id: string | null; private_request_id: string | null }>,
  };
}
