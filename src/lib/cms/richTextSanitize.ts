import "server-only";
import sanitizeHtml from "sanitize-html";
import { RICH_ALIGNMENTS, RICH_COLORS, RICH_FONT_SIZES, looksLikeHtml, normalizeColor, textToHtml } from "./richText";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const anyOf = (values: readonly string[]) => new RegExp(`^(${values.map(escapeRe).join("|")})$`, "i");

const COLOR_RE = anyOf(RICH_COLORS.map((c) => c.value));
const SIZE_RE = anyOf(RICH_FONT_SIZES.flatMap((s) => (s.value ? [s.value] : [])));
const ALIGN_RE = anyOf(RICH_ALIGNMENTS);

/**
 * Strict allowlist: only what the editor itself can produce. Everything else —
 * scripts, event handlers, iframes, images, classes, arbitrary styles, javascript:
 * links — is removed, keeping the text inside.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "a", "hr", "span"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["style"],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    ol: ["start"],
  },
  allowedStyles: {
    span: { color: [COLOR_RE], "font-size": [SIZE_RE] },
    p: { "text-align": [ALIGN_RE] },
    h2: { "text-align": [ALIGN_RE] },
    h3: { "text-align": [ALIGN_RE] },
    h4: { "text-align": [ALIGN_RE] },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    h1: "h2",
    h5: "h4",
    h6: "h4",
    b: "strong",
    i: "em",
    strike: "s",
    del: "s",
    div: "p",
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      },
    }),
  },
  // Empty, unstyled spans left over from pasted content.
  exclusiveFilter: (frame) => frame.tag === "span" && !frame.attribs.style && !frame.text.trim(),
};

/**
 * Cleans a description before it is saved. Plain text (older rows, or text that
 * never went through the editor) is kept as is — it is escaped when rendered.
 * Returns null for an editor that holds no content.
 */
export function cleanRichText(v: string | null | undefined): string | null {
  if (!v || !v.trim()) return null;
  if (!looksLikeHtml(v)) return v.trim();
  const html = sanitize(v).trim();
  const hasText = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s/g, "") !== "";
  return hasText || /<hr\b/i.test(html) ? html : null;
}

/** Safe HTML for the public page, from either storage format. Sanitised again on every render. */
export function richTextToSafeHtml(v: string | null | undefined): string {
  if (!v || !v.trim()) return "";
  return sanitize(looksLikeHtml(v) ? v : textToHtml(v));
}

/**
 * Browsers (and so the editor's output) write colours as rgb(r, g, b); the allowlist
 * speaks hex. Palette colours are converted, anything else is left to be stripped.
 */
const toHexColors = (html: string) =>
  html.replace(/(color\s*:\s*)(rgba?\([^)]*\))/gi, (m, prop: string, rgb: string) => {
    const hex = normalizeColor(rgb);
    return hex ? `${prop}${hex}` : m;
  });

const sanitize = (html: string) => sanitizeHtml(toHexColors(html), OPTIONS);
