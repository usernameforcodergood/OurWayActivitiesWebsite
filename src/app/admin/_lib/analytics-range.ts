import { athensInputToIso } from "./athens-time";

/**
 * Date ranges for the analytics dashboard, in Greek time (Europe/Athens).
 * A range is [from, to) in UTC instants; "previous" is the equivalent period
 * just before it (same length, or the previous calendar month).
 */
export const RANGE_PRESETS = ["today", "yesterday", "7d", "30d", "90d", "month", "prevmonth", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type ResolvedRange = {
  preset: RangePreset;
  from: string; // ISO
  to: string; // ISO
  prevFrom: string;
  prevTo: string;
  /** Inclusive Athens dates shown in the filter. */
  fromDate: string;
  toDate: string;
  bucket: "hour" | "day";
  days: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const MAX_DAYS = 366;

export const athensDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(d);

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(date: string, n: number): string {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
/** Start of an Athens calendar day as a UTC instant. */
const startOf = (date: string) => athensInputToIso(`${date}T00:00`)!;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const valid = (s: unknown): s is string => typeof s === "string" && ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function resolveRange(params: { range?: string; from?: string; to?: string }, now = new Date()): ResolvedRange {
  const today = athensDate(now);
  const nowIso = now.toISOString();
  const preset = (RANGE_PRESETS as readonly string[]).includes(params.range ?? "") ? (params.range as RangePreset) : "30d";
  /** A period ending "now": the previous one ends at the same moment of its own last day. */
  const rolling = (days: number): ResolvedRange => {
    const fromDate = addDays(today, -(days - 1));
    const from = startOf(fromDate);
    const shift = (iso: string) => new Date(Date.parse(iso) - days * DAY).toISOString();
    return { preset, from, to: nowIso, prevFrom: startOf(addDays(fromDate, -days)), prevTo: shift(nowIso), fromDate, toDate: today, bucket: days <= 1 ? "hour" : "day", days };
  };
  /** Whole Athens days [fromDate, toDate]; previous = the same number of days just before. */
  const fixed = (fromDate: string, toDate: string, p: RangePreset = preset): ResolvedRange => {
    const days = daysBetween(fromDate, toDate) + 1;
    return {
      preset: p,
      from: startOf(fromDate),
      to: startOf(addDays(toDate, 1)),
      prevFrom: startOf(addDays(fromDate, -days)),
      prevTo: startOf(fromDate),
      fromDate,
      toDate,
      bucket: days <= 2 ? "hour" : "day",
      days,
    };
  };

  switch (preset) {
    case "today":
      return rolling(1);
    case "yesterday":
      return fixed(addDays(today, -1), addDays(today, -1));
    case "7d":
      return rolling(7);
    case "90d":
      return rolling(90);
    case "month": {
      // This month so far vs. the same elapsed part of the previous month.
      const fromDate = `${today.slice(0, 7)}-01`;
      const prevStart = addMonths(fromDate, -1);
      const elapsed = Date.parse(nowIso) - Date.parse(startOf(fromDate));
      const prevEnd = Math.min(Date.parse(startOf(prevStart)) + elapsed, Date.parse(startOf(fromDate)));
      const days = daysBetween(fromDate, today) + 1;
      return { preset, from: startOf(fromDate), to: nowIso, prevFrom: startOf(prevStart), prevTo: new Date(prevEnd).toISOString(), fromDate, toDate: today, bucket: days <= 2 ? "hour" : "day", days };
    }
    case "prevmonth": {
      const fromDate = addMonths(`${today.slice(0, 7)}-01`, -1);
      const toDate = addDays(`${today.slice(0, 7)}-01`, -1);
      const r = fixed(fromDate, toDate);
      const prevStart = addMonths(fromDate, -1);
      return { ...r, prevFrom: startOf(prevStart), prevTo: startOf(fromDate) };
    }
    case "custom": {
      if (valid(params.from) && valid(params.to)) {
        let [a, b] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
        if (b > today) b = today;
        if (a > b) a = b;
        if (daysBetween(a, b) + 1 > MAX_DAYS) a = addDays(b, -(MAX_DAYS - 1));
        return fixed(a, b, "custom");
      }
      return { ...rolling(30), preset: "30d" };
    }
    default:
      return rolling(30);
  }
}

/** Relative change, or null when the previous value is zero/unknown. */
export function change(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}
