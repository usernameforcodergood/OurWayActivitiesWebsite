import "server-only";
import type { Channel } from "./shared";

/**
 * Traffic-channel rules (server side, applied once per session).
 *
 * Order matters:
 *  1. UTM tags, when present, win — they are what the campaign owner declared.
 *     Tags that match no rule are "unclassified" (never guessed as direct).
 *  2. A Google Ads click id (gclid) without UTM tags → paid.
 *  3. Otherwise the referring site decides: search engine → organic,
 *     social network → social, webmail → email, any other site → referral.
 *  4. No UTM tags and no external referrer → direct.
 *
 * Note: browsers send only the referring ORIGIN for cross-site navigation
 * (strict-origin-when-cross-origin), which is all these rules need.
 */

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search", "paidsocial", "paid_social", "paid-social", "cpm", "cpv", "cpa", "display", "banner", "ads", "ad", "retargeting", "affiliate"]);
const EMAIL_MEDIUMS = new Set(["email", "e-mail", "e_mail", "newsletter", "mail"]);
const SOCIAL_MEDIUMS = new Set(["social", "social-network", "social_network", "social-media", "social_media", "sm", "organic_social", "organic-social"]);
const ORGANIC_MEDIUMS = new Set(["organic", "seo"]);
const REFERRAL_MEDIUMS = new Set(["referral", "link", "partner"]);

const SEARCH_HOSTS = [
  /(^|\.)google\.[a-z.]+$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)search\.yahoo\.com$/,
  /(^|\.)yahoo\.com$/,
  /(^|\.)yandex\.[a-z.]+$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)baidu\.com$/,
  /(^|\.)startpage\.com$/,
  /(^|\.)search\.brave\.com$/,
  /(^|\.)qwant\.com$/,
  /(^|\.)naver\.com$/,
];
const SOCIAL_HOSTS = [
  /(^|\.)facebook\.com$/,
  /(^|\.)fb\.com$/,
  /(^|\.)fb\.me$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)threads\.net$/,
  /(^|\.)t\.co$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)x\.com$/,
  /(^|\.)linkedin\.com$/,
  /(^|\.)lnkd\.in$/,
  /(^|\.)pinterest\.[a-z.]+$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)youtube\.com$/,
  /(^|\.)youtu\.be$/,
  /(^|\.)reddit\.com$/,
  /(^|\.)whatsapp\.com$/,
  /(^|\.)wa\.me$/,
  /(^|\.)messenger\.com$/,
  /(^|\.)viber\.com$/,
  /(^|\.)tripadvisor\.[a-z.]+$/,
];
const SOCIAL_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "threads", "twitter", "x", "linkedin", "pinterest", "tiktok", "youtube", "reddit", "whatsapp", "messenger", "viber"]);
const SEARCH_SOURCES = new Set(["google", "bing", "duckduckgo", "yahoo", "yandex", "ecosia", "baidu"]);
const EMAIL_HOSTS = [/(^|\.)mail\.google\.com$/, /(^|\.)outlook\.(live|office)\.com$/, /(^|\.)mail\.yahoo\.com$/, /(^|\.)mail\.proton\.me$/];

const matches = (host: string, list: RegExp[]) => list.some((re) => re.test(host));

export function classifyChannel(input: {
  utm: { source?: string; medium?: string; campaign?: string };
  referrerHost?: string | null;
  gclid?: boolean;
}): Channel {
  const source = input.utm.source?.toLowerCase();
  const medium = input.utm.medium?.toLowerCase();
  const host = input.referrerHost?.toLowerCase() ?? "";
  const hasUtm = Boolean(source || medium || input.utm.campaign);

  if (hasUtm) {
    if (medium && PAID_MEDIUMS.has(medium)) return "paid";
    if (medium && EMAIL_MEDIUMS.has(medium)) return "email";
    if (medium && SOCIAL_MEDIUMS.has(medium)) return "social";
    if (medium && ORGANIC_MEDIUMS.has(medium)) return source && SOCIAL_SOURCES.has(source) ? "social" : "organic";
    if (medium && REFERRAL_MEDIUMS.has(medium)) return "referral";
    if (!medium && source) {
      if (source.includes("newsletter") || source === "email") return "email";
      if (SOCIAL_SOURCES.has(source)) return "social";
      if (SEARCH_SOURCES.has(source)) return "organic";
    }
    return "unclassified";
  }
  if (input.gclid) return "paid";
  if (host) {
    if (matches(host, SEARCH_HOSTS)) return "organic";
    if (matches(host, SOCIAL_HOSTS)) return "social";
    if (matches(host, EMAIL_HOSTS)) return "email";
    return "referral";
  }
  return "direct";
}

/** Host of an external referrer, or null for none / own site / invalid. */
export function referrerHost(referrer: string | undefined, ownHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (ownHost && host === ownHost.toLowerCase().replace(/^www\./, "")) return null;
    return host.slice(0, 253);
  } catch {
    return null;
  }
}

export type DeviceClass = "desktop" | "mobile" | "tablet" | "other";

/** Device/browser/OS classes from Next's user-agent parser plus two browser hints. */
export function classifyDevice(
  ua: { device: { type?: string }; browser: { name?: string }; os: { name?: string } },
  hints: { touch?: boolean; screen?: string },
): { device: DeviceClass; browser: string | null; os: string | null } {
  let device: DeviceClass;
  switch (ua.device.type) {
    case undefined:
      device = "desktop";
      break;
    case "mobile":
      device = "mobile";
      break;
    case "tablet":
      device = "tablet";
      break;
    default:
      device = "other";
  }
  let os = ua.os.name ?? null;
  // iPadOS presents itself as a Mac; a touch screen gives it away.
  if (device === "desktop" && os === "Mac OS" && hints.touch) {
    device = "tablet";
    os = "iOS";
  }
  if (os === "Mac OS") os = "macOS";
  const browser = (ua.browser.name ?? null)?.replace(/^Mobile /, "").slice(0, 40) ?? null;
  return { device, browser, os: os?.slice(0, 40) ?? null };
}
