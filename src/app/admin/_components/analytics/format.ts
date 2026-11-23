/** Number/time formatting for the analytics dashboard (Greek). */
const int = new Intl.NumberFormat("el-GR");
const dec = new Intl.NumberFormat("el-GR", { maximumFractionDigits: 1 });
const regions = (() => {
  try {
    return new Intl.DisplayNames(["el"], { type: "region" });
  } catch {
    return null;
  }
})();

export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : int.format(Math.round(n)));
export const fmtDec = (n: number | null | undefined) => (n == null ? "—" : dec.format(n));
export const fmtPct = (x: number | null | undefined, digits = 1) =>
  x == null || !Number.isFinite(x) ? "—" : `${new Intl.NumberFormat("el-GR", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(x * 100)}%`;
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** 75 → "1λ 15″", 8 → "8″". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}″`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}λ ${s % 60}″`;
  return `${Math.floor(m / 60)}ω ${m % 60}λ`;
}

export const countryName = (code: string | null | undefined) => {
  if (!code) return null;
  try {
    return regions?.of(code) ?? code;
  } catch {
    return code;
  }
};

/** ISO 3166-2:GR region codes (as sent by the host) → Greek names. */
const GR_REGIONS: Record<string, string> = {
  A: "Ανατολική Μακεδονία και Θράκη",
  B: "Κεντρική Μακεδονία",
  C: "Δυτική Μακεδονία",
  D: "Ήπειρος",
  E: "Θεσσαλία",
  F: "Ιόνια Νησιά",
  G: "Δυτική Ελλάδα",
  H: "Στερεά Ελλάδα",
  I: "Αττική",
  J: "Πελοπόννησος",
  K: "Βόρειο Αιγαίο",
  L: "Νότιο Αιγαίο",
  M: "Κρήτη",
  "69": "Άγιο Όρος",
};

/** Human name of a region code; other countries keep the host's code. */
export const regionName = (country: string | null | undefined, code: string) => (country === "GR" ? (GR_REGIONS[code] ?? code) : code);

/** Database bucket "2026-11-21T14:00:00" (Athens wall time) → label. */
export function bucketLabel(bucket: string, kind: "hour" | "day", long = false): string {
  const d = new Date(`${bucket.slice(0, 19)}Z`);
  if (Number.isNaN(d.getTime())) return bucket;
  if (kind === "hour") {
    const time = new Intl.DateTimeFormat("el-GR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(d);
    return long ? `${new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d)}, ${time}` : time;
  }
  return new Intl.DateTimeFormat("el-GR", { ...(long ? { weekday: "short" } : {}), day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}
