export const locales = ["el", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "el";

export function hasLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** BCP-47 tags for <html lang> and Open Graph. */
export const localeMeta: Record<Locale, { htmlLang: string; ogLocale: string; label: string; short: string }> = {
  el: { htmlLang: "el", ogLocale: "el_GR", label: "Ελληνικά", short: "GR" },
  en: { htmlLang: "en", ogLocale: "en_GB", label: "English", short: "EN" },
};
