/**
 * Converts between ISO timestamps and <input type="datetime-local"> values
 * in Greek time (Europe/Athens), independent of the browser/server timezone.
 */
const TZ = "Europe/Athens";

function offsetMinutes(date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT+02:00"
  const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** "2026-11-14T09:30:00Z" → "2026-11-14T11:30" (Athens). */
export function isoToAthensInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() + offsetMinutes(d) * 60_000);
  return local.toISOString().slice(0, 16);
}

/** "2026-11-14T11:30" (Athens) → ISO UTC string, or null if empty/invalid. */
export function athensInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00Z`);
  // Two passes handle the DST edge correctly.
  let iso = new Date(asUtc.getTime() - offsetMinutes(asUtc) * 60_000);
  iso = new Date(asUtc.getTime() - offsetMinutes(iso) * 60_000);
  return iso.toISOString();
}
