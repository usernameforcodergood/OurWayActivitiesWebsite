import type { Locale } from "@/i18n/config";
import { mediaUrl } from "@/lib/supabase/config";
import type {
  AnnouncementRow,
  CmsImage,
  ExcursionRow,
  MediaRow,
  PublicAnnouncement,
  PublicDeparture,
  PublicExcursion,
} from "./types";

/** Row returned by the public_departures() database function. */
export type DepartureAvailabilityRow = {
  id: string;
  departure_date: string;
  departure_time: string | null;
  return_time: string | null;
  price_eur: number | string | null;
  capacity: number | null;
  min_participants: number | null;
  remaining: number | null;
  booking_deadline: string | null;
  state: PublicDeparture["state"];
  note_el: string | null;
  note_en: string | null;
  /** Added in 0010; absent until that migration runs. */
  return_date?: string | null;
  deposit_eur?: number | string | null;
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

/**
 * Days a visitor can still request, from public_departures(): only runs in
 * state "open" (the database already marks cancelled, completed, started,
 * past-deadline and full runs otherwise). Unique, soonest first.
 */
export function availableDays(rows: Pick<DepartureAvailabilityRow, "departure_date" | "state">[]): string[] {
  return [...new Set(rows.filter((d) => d.state === "open").map((d) => d.departure_date))].sort();
}

export function toPublicDeparture(r: DepartureAvailabilityRow): PublicDeparture {
  return {
    id: r.id,
    date: r.departure_date,
    time: r.departure_time,
    returnTime: r.return_time,
    returnDate: r.return_date ?? null,
    priceEur: num(r.price_eur),
    depositEur: num(r.deposit_eur),
    capacity: r.capacity,
    minParticipants: r.min_participants,
    remaining: r.remaining,
    deadline: r.booking_deadline,
    state: r.state,
    noteEl: r.note_el,
    noteEn: r.note_en,
  };
}

const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : undefined);

/** Splits a long text field into paragraphs on blank lines. */
export function paragraphs(v: string | null | undefined): string[] {
  return (v ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** A language version is publishable only when it has a title and a summary. */
export function availableLocales(row: {
  title_el: string | null;
  title_en: string | null;
  summary_el: string | null;
  summary_en: string | null;
}): Locale[] {
  const out: Locale[] = [];
  if (text(row.title_el) && text(row.summary_el)) out.push("el");
  if (text(row.title_en) && text(row.summary_en)) out.push("en");
  return out;
}

export function toImage(m: MediaRow | null | undefined, locale: Locale, fallbackAlt: string): CmsImage | null {
  if (!m) return null;
  return {
    src: mediaUrl(m.path),
    width: m.width ?? 1600,
    height: m.height ?? 1067,
    alt: text(locale === "el" ? m.alt_el : m.alt_en) ?? text(locale === "el" ? m.alt_en : m.alt_el) ?? fallbackAlt,
  };
}

function pick<T extends Record<string, unknown>>(row: T, field: string, locale: Locale): string | undefined {
  return text(row[`${field}_${locale}`] as string | null);
}

export function toPublicExcursion(row: ExcursionRow, locale: Locale): PublicExcursion {
  const title = pick(row, "title", locale) ?? "";
  const price = row.price_eur === null || row.price_eur === "" ? undefined : Number(row.price_eur);
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind ?? "excursion",
    bookingMode: row.booking_mode ?? "departures",
    meetingPoint: pick(row, "meeting_point", locale),
    included: paragraphs(locale === "el" ? row.included_el : row.included_en),
    cancellationPolicy: paragraphs(locale === "el" ? row.cancellation_policy_el : row.cancellation_policy_en),
    departures: (row.departures ?? [])
      .slice()
      .sort((a, b) => (a.departure_date + (a.departure_time ?? "")).localeCompare(b.departure_date + (b.departure_time ?? "")))
      .map((d) => ({
        id: d.id,
        date: d.departure_date,
        time: d.departure_time,
        priceEur: num(d.price_eur) ?? (Number.isFinite(price) ? (price as number) : null),
        status: d.status,
      })),
    availableDates: null,
    featured: row.featured,
    locales: availableLocales(row),
    title,
    summary: pick(row, "summary", locale) ?? "",
    description: (locale === "el" ? row.description_el : row.description_en)?.trim() ?? "",
    destination: pick(row, "destination", locale),
    primaryCategory: row.primary_category ?? null,
    category: pick(row, "category", locale),
    duration: pick(row, "duration", locale),
    difficulty: pick(row, "difficulty", locale),
    participants: text(row.participants),
    priceEur: Number.isFinite(price) ? price : undefined,
    depositEur: num(row.deposit_eur) ?? undefined,
    availabilityNote: pick(row, "availability_note", locale),
    info: paragraphs(locale === "el" ? row.info_el : row.info_en),
    cover: toImage(row.cover, locale, title),
    gallery: (row.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => toImage(i.media, locale, title))
      .filter((i): i is CmsImage => i !== null),
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicAnnouncement(row: AnnouncementRow, locale: Locale): PublicAnnouncement {
  const title = pick(row, "title", locale) ?? "";
  return {
    slug: row.slug,
    featured: row.featured,
    locales: availableLocales(row),
    title,
    summary: pick(row, "summary", locale) ?? "",
    body: paragraphs(locale === "el" ? row.body_el : row.body_en),
    image: toImage(row.image, locale, title),
    publishAt: row.publish_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

const GREEK: Record<string, string> = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i", θ: "th",
  ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", ό: "o",
  π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y", ΰ: "y", φ: "f", χ: "ch",
  ψ: "ps", ω: "o", ώ: "o",
};

/** URL-safe slug; Greek is transliterated ("Χορτιάτης" → "chortiatis"). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ου/g, "ou")
    .replace(/μπ/g, "b")
    .replace(/ντ/g, "nt")
    .split("")
    .map((c) => GREEK[c] ?? c)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
