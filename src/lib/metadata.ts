import type { Metadata } from "next";
import { locales, localeMeta, type Locale } from "@/i18n/config";
import { siteConfig } from "./site";
import { media } from "@/content/media";

type BuildMetadataInput = {
  locale: Locale;
  /** Path after the locale, e.g. "/about" ("" for home). */
  path: string;
  title: string;
  description: string;
  /** Use the title as-is (no "— OurWay" suffix). */
  absoluteTitle?: boolean;
  image?: { src: string; alt: string };
  noIndex?: boolean;
};

export function buildMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle,
  image,
  noIndex,
}: BuildMetadataInput): Metadata {
  const url = `${siteConfig.url}/${locale}${path}`;
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeMeta[l].htmlLang] = `${siteConfig.url}/${l}${path}`;
  languages["x-default"] = `${siteConfig.url}/el${path}`;

  const ogImage = image ?? {
    src: media.heroWalker.src.replace(/\?.*$/, "?auto=format&fit=crop&w=1200&h=630&q=75"),
    alt: media.heroWalker.alt[locale],
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      locale: localeMeta[locale].ogLocale,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeMeta[l].ogLocale),
      url,
      title,
      description,
      images: [{ url: ogImage.src, width: 1200, height: 630, alt: ogImage.alt }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage.src] },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
