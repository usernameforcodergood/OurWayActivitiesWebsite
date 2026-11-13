export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Pads an index for editorial numbering: 1 -> "01". */
export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
