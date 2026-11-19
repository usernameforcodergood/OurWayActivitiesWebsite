/**
 * Rich text (formatted descriptions) — shared, dependency-free helpers.
 * Safe to import from client components; sanitising lives in richTextSanitize.ts.
 *
 * Storage: the existing text columns hold HTML produced by the admin editor.
 * Older rows hold plain text (paragraphs split by blank lines); both render.
 */

/**
 * The only text colours allowed. Mid-tone on purpose: each one stays readable
 * on the white admin editor and on the dark public page, so the preview never lies.
 */
export const RICH_COLORS = [
  { value: "#b98458", name: "Χώμα" },
  { value: "#d39a2a", name: "Κεχριμπάρι" },
  { value: "#d9534f", name: "Κόκκινο" },
  { value: "#4f9d69", name: "Πράσινο" },
  { value: "#2fa3b0", name: "Λιμνοθάλασσα" },
  { value: "#4a86c8", name: "Μπλε" },
  { value: "#9b6fc4", name: "Μωβ" },
] as const;

/** Text sizes, relative to the surrounding text so they scale on every screen. */
export const RICH_FONT_SIZES = [
  { value: "0.875em", name: "Μικρό" },
  { value: null, name: "Κανονικό" },
  { value: "1.25em", name: "Μεγάλο" },
  { value: "1.5em", name: "Πολύ μεγάλο" },
] as const;

export const RICH_ALIGNMENTS = ["left", "center", "right", "justify"] as const;

const COLOR_SET = new Set<string>(RICH_COLORS.map((c) => c.value));
const SIZE_SET = new Set<string>(RICH_FONT_SIZES.flatMap((s) => (s.value ? [s.value] : [])));

/** Maps any CSS colour string (hex or rgb()) to an allowed palette colour, else null. */
export function normalizeColor(css: string | null | undefined): string | null {
  if (!css) return null;
  const v = css.trim().toLowerCase();
  if (COLOR_SET.has(v)) return v;
  const m = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(?:1|1\.0+)\s*)?\)$/);
  if (!m) return null;
  const hex = `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  return COLOR_SET.has(hex) ? hex : null;
}

export function normalizeFontSize(css: string | null | undefined): string | null {
  const v = css?.trim().toLowerCase();
  return v && SIZE_SET.has(v) ? v : null;
}

/** True when the stored value was written by the rich text editor. */
export function looksLikeHtml(v: string | null | undefined): boolean {
  return Boolean(v && /^\s*<(p|h[1-6]|ul|ol|li|hr|div|span|strong|em|b|i|u|s|a|br|blockquote)[\s>/]/i.test(v));
}

export function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Older plain-text descriptions → paragraphs (blank line) and line breaks (single newline). */
export function textToHtml(v: string | null | undefined): string {
  return (v ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** What the editor should open with, for either storage format. */
export function toEditorHtml(v: string | null | undefined): string {
  return looksLikeHtml(v) ? (v as string) : textToHtml(v);
}
