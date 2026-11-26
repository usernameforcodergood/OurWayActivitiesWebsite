import type { Locale } from "@/i18n/config";

const tag = (locale: Locale) => (locale === "el" ? "el-GR" : "en-GB");

/** "Saturday 12 April 2027, 08:00" — the date is a plain calendar day. */
export function formatDateLong(iso: string, locale: Locale, time?: string | null): string {
  const d = new Intl.DateTimeFormat(tag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
  return time ? `${d}, ${time.slice(0, 5)}` : d;
}

/** "Sat 12 Apr" */
export function formatDateShort(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** A moment in time shown in Greek local time. */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  }).format(new Date(iso));
}

export function formatEur(n: number, locale: Locale): string {
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);
}

/**
 * Compact list of calendar days for experience cards, month and year written
 * once per group: "15 Δεκεμβρίου 2026", "15 & 22 Δεκεμβρίου 2026",
 * "28 Νοεμβρίου, 5 & 12 Δεκεμβρίου 2026", "28 December 2026 & 4 January 2027".
 * Duplicates are dropped; at most `max` days are written, `more` counts the rest.
 */
export function formatDayList(dates: string[], locale: Locale, max = 4): { text: string; more: number } {
  const all = [...new Set(dates)].sort();
  const list = all.slice(0, max);
  const tokens = list.map((iso, i) => {
    const next = list[i + 1];
    const lastOfYear = !next || next.slice(0, 4) !== iso.slice(0, 4);
    const lastOfMonth = lastOfYear || next.slice(0, 7) !== iso.slice(0, 7);
    if (!lastOfMonth) return String(Number(iso.slice(8, 10)));
    return new Intl.DateTimeFormat(tag(locale), {
      day: "numeric",
      month: "long",
      ...(lastOfYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  });
  const text = tokens.length < 2 ? (tokens[0] ?? "") : `${tokens.slice(0, -1).join(", ")} & ${tokens[tokens.length - 1]}`;
  return { text, more: all.length - list.length };
}

/** "15 Δεκεμβρίου 2026", or a range for multi-day trips: "14–15 Δεκεμβρίου 2026". */
export function formatDayRange(from: string, until: string | null | undefined, locale: Locale): string {
  const f = new Intl.DateTimeFormat(tag(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const a = new Date(`${from}T00:00:00Z`);
  if (!until || until === from) return f.format(a);
  return f.formatRange(a, new Date(`${until}T00:00:00Z`));
}
