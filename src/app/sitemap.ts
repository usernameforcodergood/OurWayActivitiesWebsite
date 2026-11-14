import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/i18n/config";
import { routes } from "@/i18n/routes";
import { siteConfig } from "@/lib/site";
import { getActiveAnnouncements, getPublishedExcursions } from "@/lib/cms/public";

type Entry = { path: string; langs: readonly Locale[]; priority: number; lastModified?: string };

function toUrls({ path, langs, priority, lastModified }: Entry): MetadataRoute.Sitemap {
  return langs.map((locale) => ({
    url: `${siteConfig.url}/${locale}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority,
    alternates: {
      languages: Object.fromEntries([
        ...langs.map((l) => [l, `${siteConfig.url}/${l}${path}`]),
        ...(langs.includes("el") ? [["x-default", `${siteConfig.url}/el${path}`]] : []),
      ]),
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: Entry[] = [
    routes.home,
    routes.activities,
    routes.destinations,
    routes.news,
    routes.about,
    routes.gallery,
    routes.contact,
    routes.privacy,
  ].map((path) => ({ path, langs: locales, priority: path === "" ? 1 : 0.7 }));

  // Published content, listed only in the languages it is complete in.
  const [exEl, exEn, newsEl, newsEn] = await Promise.all([
    getPublishedExcursions("el"),
    getPublishedExcursions("en"),
    getActiveAnnouncements("el"),
    getActiveAnnouncements("en"),
  ]);
  const collect = <T extends { slug: string; locales: Locale[]; updatedAt: string }>(a: T[], b: T[], base: string, priority: number) => {
    const map = new Map<string, T>();
    for (const x of [...a, ...b]) map.set(x.slug, x);
    return [...map.values()].map((x) => ({ path: `${base}/${x.slug}`, langs: x.locales, priority, lastModified: x.updatedAt }));
  };

  return [
    ...pages,
    ...collect(exEl, exEn, routes.activities, 0.8),
    ...collect(newsEl, newsEn, routes.news, 0.5),
  ].flatMap(toUrls);
}
