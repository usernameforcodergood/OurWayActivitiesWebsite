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
