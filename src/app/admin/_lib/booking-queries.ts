import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DepartureRow } from "@/lib/cms/types";
import {
  BOOKING_STATUSES,
  EXPERIENCE_TYPES,
  INQUIRY_STATUSES,
  PRIVATE_STATUSES,
  type BookingStatus,
  type ExperienceType,
  type PrivateStatus,
} from "@/lib/bookings/validation";
import { ilikePattern } from "../_components/ListToolbar";
import { PAGE_SIZE } from "./queries";
import { athensInputToIso } from "./athens-time";
import { PAYMENT_FILTERS, num, type BookingMoney, type PaymentFilter, type PaymentRow } from "./payments";

/** Admin reads use the admin's session; RLS hides everything from anyone else. */

export type BookingOverviewRow = BookingMoney & {
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
  /** General-experience inquiries only (migration 0007). */
  preferred_period: string | null;
  /** Migration 0011: the run's last day / status, and the customer's own text. */
  return_date?: string | null;
  departure_status?: string | null;
  message?: string | null;
  special_requests?: string | null;
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

/* --------------------------- Bookings admin page ---------------------------- */

export const BOOKING_SECTIONS = ["bookings", "inquiries"] as const;
export type BookingSection = (typeof BOOKING_SECTIONS)[number];
export const DEPARTURE_WINDOWS = ["upcoming", "past", "all"] as const;
export type DepartureWindow = (typeof DEPARTURE_WINDOWS)[number];
export const INQUIRY_SORTS = ["submitted", "submitted_asc"] as const;
export const DATE_SORTS = ["date_asc", "date_desc"] as const;

export type BookingListParams = {
  /** «Κρατήσεις εκδρομών» (kind = booking, grouped by date) or «Ερωτήματα εμπειριών» (kind = interest). */
  section: BookingSection;
  q: string;
  status: "all" | BookingStatus;
  /** Upcoming / past / all dates. null = not chosen (upcoming, or all while a filter is active). */
  when: DepartureWindow | null;
  /** Also list dates that have no requests. */
  showEmpty: boolean;
  // "Περισσότερα φίλτρα" — always optional.
  excursion: string;
  /** One date (departure uuid), e.g. from an excursion's page. */
  departure: string;
  /** Departure date range. */
  from: string;
  to: string;
  /** Submission date range. */
  sfrom: string;
  sto: string;
  /** Bookings: date order. Inquiries: submission order. "" = section default. */
  sort: "" | (typeof DATE_SORTS)[number] | (typeof INQUIRY_SORTS)[number];
  /** Money still owed ("open") or money to give back ("refund"); "all" = no filter. */
  payment: "all" | PaymentFilter;
  /** Inquiries only (the bookings view is grouped, not paged). */
  page: number;
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export function parseBookingParams(sp: Record<string, string | string[] | undefined>): BookingListParams {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  // Old links: ?kind=interest and ?departure=none (requests without a date) meant inquiries.
  const section: BookingSection =
    one("section") === "inquiries" || (one("section") === "" && (one("kind") === "interest" || one("departure") === "none")) ? "inquiries" : "bookings";
  const statuses: readonly string[] = section === "inquiries" ? INQUIRY_STATUSES : BOOKING_STATUSES;
  const sorts: readonly string[] = section === "inquiries" ? INQUIRY_SORTS : DATE_SORTS;
  const page = Number.parseInt(one("page"), 10);
  return {
    section,
    q: one("q").trim().slice(0, 100),
    status: statuses.includes(one("status")) ? (one("status") as BookingStatus) : "all",
    when: (DEPARTURE_WINDOWS as readonly string[]).includes(one("when")) ? (one("when") as DepartureWindow) : null,
    showEmpty: one("empty") === "1",
    excursion: isUuid(one("excursion")) ? one("excursion") : "",
    departure: section === "bookings" && isUuid(one("departure")) ? one("departure") : "",
    from: isDate(one("from")) ? one("from") : "",
    to: isDate(one("to")) ? one("to") : "",
    sfrom: isDate(one("sfrom")) ? one("sfrom") : "",
    sto: isDate(one("sto")) ? one("sto") : "",
    sort: sorts.includes(one("sort")) ? (one("sort") as BookingListParams["sort"]) : "",
    payment: (PAYMENT_FILTERS as readonly string[]).includes(one("payment")) ? (one("payment") as PaymentFilter) : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Filters that narrow the requests themselves (not just which dates are shown). */
export function hasRequestFilters(p: BookingListParams): boolean {
  return Boolean(p.q || p.sfrom || p.sto) || p.status !== "all" || p.payment !== "all";
}

/** Any filter at all (anything beyond the default view). */
export function hasAnyFilter(p: BookingListParams): boolean {
  return hasRequestFilters(p) || Boolean(p.excursion || p.departure || p.from || p.to);
}

/** Upcoming by default; while searching / filtering, every date unless one was chosen. */
export function effectiveWindow(p: BookingListParams): DepartureWindow {
  return p.when ?? (hasAnyFilter(p) ? "all" : "upcoming");
}

/** Submission-date filter bounds: Athens days → UTC instants (DST-aware). [start, next day start). */
function athensDayRange(from: string, to: string): { gte: string | null; lt: string | null } {
  const next = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { gte: from ? athensInputToIso(`${from}T00:00`) : null, lt: to ? athensInputToIso(`${next(to)}T00:00`) : null };
}

/** Search across customer, contact, reference and excursion title. */
function searchOr(q: string) {
  const pat = ilikePattern(q);
  return `full_name.ilike.${pat},email.ilike.${pat},reference.ilike.${pat},phone.ilike.${pat},excursion_title_el.ilike.${pat},excursion_title_en.ilike.${pat}`;
}

export type DepartureGroupRow = {
  id: string;
  departure_date: string;
  return_date: string | null;
  departure_time: string | null;
  capacity: number | null;
  status: "open" | "full" | "cancelled" | "completed";
  /** All requests of this date, whatever the filters. */
  summary: { requests: number; pending: number; confirmedPeople: number; heldPeople: number };
  /** The requests to list (filtered when a filter is active). */
  requests: BookingOverviewRow[];
};
export type ExcursionGroup = { excursionId: string; title: string; slug: string; dates: DepartureGroupRow[] };

type DepartureWithExcursion = Omit<DepartureGroupRow, "summary" | "requests"> & {
  excursion_id: string;
  excursion: { id: string; title_el: string | null; title_en: string | null; slug: string } | null;
};

/**
 * «Κρατήσεις εκδρομών»: Excursion → date → requests, nearest date first.
 * Dates come from public.departures (so dates without requests can be shown);
 * requests from booking_overview; capacity from admin_departure_stats — the
 * same sources the rest of the admin uses.
 */
export async function listDepartureGroups(p: BookingListParams, today: string) {
  const db = await createSupabaseServerClient();
  const win = effectiveWindow(p);
  const ascending = p.sort ? p.sort === "date_asc" : win !== "past";
  const filtered = hasRequestFilters(p);

  // Shared "which dates" conditions, applied to departures and to the view alike.
  type Q = { or(f: string): Q; gte(c: string, v: string): Q; lte(c: string, v: string): Q; lt(c: string, v: string): Q; eq(c: string, v: string): Q };
  // (Unconstrained generic: checking the Supabase builder against Q overflows TS.)
  const dateScope = <T,>(q: T, excursionCol: string, idCol: string): T => {
    let r = q as unknown as Q;
    if (win === "upcoming") r = r.or(`departure_date.gte.${today},return_date.gte.${today}`);
    if (win === "past") r = r.lt("departure_date", today).or(`return_date.is.null,return_date.lt.${today}`);
    if (p.excursion) r = r.eq(excursionCol, p.excursion);
    if (p.departure) r = r.eq(idCol, p.departure);
    if (p.from) r = r.gte("departure_date", p.from);
    if (p.to) r = r.lte("departure_date", p.to);
    return r as unknown as T;
  };

  const depQuery = dateScope(
    db
      .from("departures")
      .select("id, excursion_id, departure_date, return_date, departure_time, capacity, status, excursion:excursions(id, title_el, title_en, slug)"),
    "excursion_id",
    "id",
  )
    .order("departure_date", { ascending })
    .order("departure_time", { ascending })
    .limit(500);

  // Every request of the dates in scope (for the per-date summary)…
  const allQuery = dateScope(db.from("booking_overview").select("*").eq("kind", "booking"), "excursion_id", "departure_id")
    .order("created_at", { ascending: true })
    .limit(5000);

  // …and, when filtering, only the matching ones (to list).
  let matchQuery = filtered ? dateScope(db.from("booking_overview").select("*").eq("kind", "booking"), "excursion_id", "departure_id") : null;
  if (matchQuery) {
    if (p.status !== "all") matchQuery = matchQuery.eq("status", p.status);
    if (p.payment === "open") matchQuery = matchQuery.eq("payment_open", true);
    else if (p.payment === "refund") matchQuery = matchQuery.eq("refund_due", true);
    const sub = athensDayRange(p.sfrom, p.sto);
    if (sub.gte) matchQuery = matchQuery.gte("created_at", sub.gte);
    if (sub.lt) matchQuery = matchQuery.lt("created_at", sub.lt);
    if (p.q) matchQuery = matchQuery.or(searchOr(p.q));
  }

  const [deps, all, match] = await Promise.all([
    depQuery,
    allQuery,
    matchQuery ? matchQuery.order("created_at", { ascending: true }).limit(5000) : Promise.resolve(null),
  ]);
  if (deps.error) console.error("[admin] departure groups:", deps.error.message);
  if (all.error) console.error("[admin] departure requests:", all.error.message);
  if (match?.error) console.error("[admin] departure requests (filtered):", match.error.message);

  const departures = (deps.data ?? []) as unknown as DepartureWithExcursion[];
  const allRows = (all.data ?? []) as BookingOverviewRow[];
  const listRows = match ? ((match.data ?? []) as BookingOverviewRow[]) : allRows;
  const stats = await getDepartureStats(departures.map((d) => d.id));

  const byDeparture = (rows: BookingOverviewRow[]) => {
    const m = new Map<string, BookingOverviewRow[]>();
    for (const r of rows) if (r.departure_id) m.set(r.departure_id, [...(m.get(r.departure_id) ?? []), r]);
    return m;
  };
  const allBy = byDeparture(allRows);
  const listBy = byDeparture(listRows);

  const groups = new Map<string, ExcursionGroup>();
  let shownDates = 0;
  for (const d of departures) {
    const every = allBy.get(d.id) ?? [];
    // Requests waiting for an answer first; otherwise first come, first listed (stable sort).
    const listed = [...(listBy.get(d.id) ?? [])].sort((x, y) => Number(y.status === "pending") - Number(x.status === "pending"));
    // With a filter: only dates with matches. Otherwise: dates with requests (+ empty ones on request, or the one date asked for).
    const visible = filtered ? listed.length > 0 : every.length > 0 || p.showEmpty || p.departure === d.id;
    if (!visible) continue;
    const s = stats.get(d.id);
    const row: DepartureGroupRow = {
      id: d.id,
      departure_date: d.departure_date,
      return_date: d.return_date,
      departure_time: d.departure_time,
      capacity: d.capacity,
      status: d.status,
      summary: {
        requests: every.length,
        pending: every.filter((r) => r.status === "pending").length,
        // Confirmed or already completed (a past run's bookings are "completed").
        confirmedPeople: every.filter((r) => r.status === "confirmed" || r.status === "completed").reduce((a, r) => a + r.participants, 0),
        heldPeople: (s?.confirmed ?? 0) + (s?.pending_held ?? 0),
      },
      requests: listed,
    };
    const ex = d.excursion;
    const g = groups.get(d.excursion_id) ?? {
      excursionId: d.excursion_id,
      title: ex?.title_el || ex?.title_en || ex?.slug || "—",
      slug: ex?.slug ?? "",
      dates: [],
    };
    g.dates.push(row);
    groups.set(d.excursion_id, g);
    shownDates++;
  }
  // Map keeps first-seen order = the excursion's nearest (or latest) date first.
  return { window: win, groups: [...groups.values()], shownDates, truncated: departures.length >= 500 || allRows.length >= 5000 };
}

/** «Ερωτήματα εμπειριών»: general-experience inquiries (no scheduled date), newest first. */
export async function listInquiries(p: BookingListParams) {
  const db = await createSupabaseServerClient();
  let q = db.from("booking_overview").select("*", { count: "exact" }).eq("kind", "interest");
  if (p.status !== "all") q = q.eq("status", p.status);
  if (p.excursion) q = q.eq("excursion_id", p.excursion);
  if (p.payment === "open") q = q.eq("payment_open", true);
  else if (p.payment === "refund") q = q.eq("refund_due", true);
  const sub = athensDayRange(p.sfrom, p.sto);
  if (sub.gte) q = q.gte("created_at", sub.gte);
  if (sub.lt) q = q.lt("created_at", sub.lt);
  if (p.q) q = q.or(searchOr(p.q));
  q = q.order("created_at", { ascending: p.sort === "submitted_asc" });
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) console.error("[admin] list inquiries:", error.message);
  return { rows: (data ?? []) as BookingOverviewRow[], total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)) };
}

/** Badges on the two section tabs: what needs a reply. */
export async function getSectionCounts() {
  const db = await createSupabaseServerClient();
  const [pending, fresh] = await Promise.all([
    db.from("bookings").select("id", { count: "exact", head: true }).eq("kind", "booking").eq("status", "pending"),
    db.from("bookings").select("id", { count: "exact", head: true }).eq("kind", "interest").eq("status", "new"),
  ]);
  return { pendingBookings: pending.count ?? 0, newInquiries: fresh.count ?? 0 };
}

/** Count of inquiries matching a payment filter (to point to them from the bookings view). */
export async function countInquiryPayments(payment: PaymentFilter) {
  const db = await createSupabaseServerClient();
  const { count } = await db
    .from("booking_overview")
    .select("id", { count: "exact", head: true })
    .eq("kind", "interest")
    .eq(payment === "open" ? "payment_open" : "refund_due", true);
  return count ?? 0;
}

/** Excursions for the filter dropdown. */
export async function listExcursionOptions() {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("excursions").select("id, title_el, title_en, slug").order("updated_at", { ascending: false }).limit(300);
  return (data ?? []) as Array<{ id: string; title_el: string | null; title_en: string | null; slug: string }>;
}

/** Runs of one excursion for the date filter (newest first). */
export async function listDepartureOptions(excursionId: string) {
  if (!isUuid(excursionId)) return [];
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("departures")
    .select("id, departure_date, return_date, departure_time, status")
    .eq("excursion_id", excursionId)
    .order("departure_date", { ascending: false })
    .limit(200);
  return (data ?? []) as DepartureOption[];
}
export type DepartureOption = { id: string; departure_date: string; return_date: string | null; departure_time: string | null; status: string };

/** Every request of one excursion (all runs + requests without a date), for its admin page. */
export async function listExcursionRequests(excursionId: string) {
  if (!isUuid(excursionId)) return [];
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("booking_overview")
    .select("*")
    .eq("excursion_id", excursionId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) console.error("[admin] excursion requests:", error.message);
  return (data ?? []) as BookingOverviewRow[];
}

export async function getBookingDetail(id: string) {
  if (!isUuid(id)) return null;
  const db = await createSupabaseServerClient();
  const [{ data: overview, error: overviewError }, { data: extra, error: extraError }, { data: history }, { data: notes }, { data: emails }, { data: payments, error: paymentsError }] = await Promise.all([
    db.from("booking_overview").select("*").eq("id", id).maybeSingle(),
    // Since 0011 bookings has two keys to departures (departure_id and the composite
    // (departure_id, excursion_id)), so the embed must name one or PostgREST refuses it.
    db
      .from("bookings")
      .select("message, special_requests, consent_at, departure:departures!bookings_departure_id_fkey(id, capacity, status, booking_deadline)")
      .eq("id", id)
      .maybeSingle(),
    db.from("request_status_history").select("id, from_status, to_status, note, changed_by, created_at").eq("booking_id", id).order("created_at"),
    db.from("request_notes").select("id, body, author_id, created_at").eq("booking_id", id).order("created_at", { ascending: false }),
    db.from("email_notifications").select("id, kind, recipient, status, error, created_at").eq("booking_id", id).order("created_at", { ascending: false }),
    db
      .from("booking_payments")
      .select("id, kind, amount_eur, paid_on, method, note, recorded_by, created_at, voided_at, void_reason")
      .eq("booking_id", id)
      .order("paid_on", { ascending: false })
      .order("id", { ascending: false }),
  ]);
  if (overviewError) console.error("[admin] booking overview:", overviewError.message);
  if (extraError) console.error("[admin] booking detail:", extraError.message);
  if (paymentsError) console.error("[admin] payments:", paymentsError.message);
  if (!overview || !extra) return null;
  const booking = { ...(overview as BookingOverviewRow), ...(extra as unknown as Omit<BookingDetail, keyof BookingOverviewRow>) } as BookingDetail;
  return {
    booking,
    history: (history ?? []) as HistoryRow[],
    notes: (notes ?? []) as NoteRow[],
    emails: (emails ?? []) as EmailRow[],
    payments: (payments ?? []) as PaymentRow[],
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

/* -------------------- Tailor-made requests (private_requests) ------------------- */

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
  experience_type: ExperienceType | null;
  date_from: string | null;
  date_to: string | null;
  dates_flexible: boolean;
  duration: string | null;
  difficulty: string | null;
  transport: string | null;
  activities: string | null;
  budget_per_person: string | null;
  message: string | null;
  additional_requirements: string | null;
  locale: "el" | "en";
  proposal_itinerary: string | null;
  proposal_dates: string | null;
  proposal_price_eur: string | number | null;
  consent_at: string;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
};

const PRIVATE_COLS =
  "id, reference, status, first_name, last_name, email, phone, participants, destination, destination_flexible, excursion_type, experience_type, date_from, date_to, dates_flexible, duration, difficulty, transport, activities, budget_per_person, message, additional_requirements, locale, proposal_itinerary, proposal_dates, proposal_price_eur, consent_at, status_changed_at, created_at, updated_at";

export const PRIVATE_SORTS = ["newest", "oldest", "status"] as const;
export type PrivateSort = (typeof PRIVATE_SORTS)[number];
export type PrivateListParams = { q: string; status: "all" | PrivateStatus; type: "all" | ExperienceType; sort: PrivateSort; page: number };

export function parsePrivateParams(sp: Record<string, string | string[] | undefined>): PrivateListParams {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = one("status");
  const type = one("type");
  const sort = one("sort");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").slice(0, 100),
    status: (PRIVATE_STATUSES as readonly string[]).includes(status) ? (status as PrivateStatus) : "all",
    type: (EXPERIENCE_TYPES as readonly string[]).includes(type) ? (type as ExperienceType) : "all",
    sort: (PRIVATE_SORTS as readonly string[]).includes(sort) ? (sort as PrivateSort) : "newest",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listPrivateRequests(p: PrivateListParams) {
  const db = await createSupabaseServerClient();
  let q = db.from("private_requests").select(PRIVATE_COLS, { count: "exact" });
  if (p.status !== "all") q = q.eq("status", p.status);
  if (p.type !== "all") q = q.eq("experience_type", p.type);
  if (p.q) {
    const pat = ilikePattern(p.q);
    q = q.or(
      `first_name.ilike.${pat},last_name.ilike.${pat},email.ilike.${pat},phone.ilike.${pat},reference.ilike.${pat},destination.ilike.${pat},message.ilike.${pat}`,
    );
  }
  if (p.sort === "status") q = q.order("status_rank").order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: p.sort === "oldest" });
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
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
  const [pending, confirmed, upcoming, recent, privNew, failures, inquiriesNew, owed, refunds] = await Promise.all([
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
    db.from("bookings").select("id", { count: "exact", head: true }).eq("kind", "interest").eq("status", "new"),
    db.from("booking_overview").select("balance_eur").eq("payment_open", true).limit(5000),
    db.from("booking_overview").select("net_paid_eur").eq("refund_due", true).limit(5000),
  ]);
  if (owed.error) console.error("[admin] dashboard payments:", owed.error.message);
  if (refunds.error) console.error("[admin] dashboard refunds:", refunds.error.message);
  // Sum in cents so many small amounts never add up to 99.99999.
  const cents = (rows: Array<Record<string, string | number | null>> | null, key: string) =>
    (rows ?? []).reduce((a, r) => a + Math.round((num(r[key]) ?? 0) * 100), 0) / 100;
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
    newInquiries: inquiriesNew.count ?? 0,
    paymentsOpenCount: owed.data?.length ?? 0,
    paymentsOpenEur: cents(owed.data, "balance_eur"),
    refundsDueCount: refunds.data?.length ?? 0,
    refundsDueEur: cents(refunds.data, "net_paid_eur"),
    full,
    failures: (failures.data ?? []) as Array<EmailRow & { booking_id: string | null; private_request_id: string | null }>,
  };
}
