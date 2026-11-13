import type { Locale } from "./config";
import type el from "@/messages/el.json";

/** The Greek file is the source of truth for the message shape. */
export type Dictionary = typeof el;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  el: () => import("@/messages/el.json").then((m) => m.default),
  // `satisfies` would be ideal but JSON imports are widened; this import is
  // type-checked against Dictionary in src/i18n/check.ts.
  en: () => import("@/messages/en.json").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

/** Minimal interpolation: format("{a} of {b}", { a: 1, b: 2 }). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
