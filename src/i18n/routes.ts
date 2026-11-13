import { locales, type Locale } from "./config";

/** Every localised route. Paths are identical across languages, so switching
 *  language only swaps the first segment. */
export const routes = {
  home: "",
  activities: "/activities",
  destinations: "/destinations",
  about: "/about",
  gallery: "/gallery",
  contact: "/contact",
  privacy: "/privacy",
} as const;

export type RouteKey = keyof typeof routes;

export function localePath(locale: Locale, path: string = ""): string {
  return `/${locale}${path}`;
}

/**
 * Returns the equivalent path in another locale, preserving query/hash-free path.
 * Unknown structures fall back to the target locale's homepage.
 */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || !(locales as readonly string[]).includes(segments[0])) {
    return localePath(target);
  }
  segments[0] = target;
  return `/${segments.join("/")}`;
}
