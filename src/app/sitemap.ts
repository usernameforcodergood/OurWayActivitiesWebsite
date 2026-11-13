import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { routes } from "@/i18n/routes";
import { siteConfig } from "@/lib/site";
import { getActivities } from "@/content/activities";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths: string[] = [
    routes.home,
    routes.activities,
    routes.destinations,
    routes.about,
    routes.gallery,
    routes.contact,
    routes.privacy,
    // Only published experiences are listed (drafts never reach production).
    ...getActivities()
      .filter((a) => a.status === "published")
      .map((a) => `${routes.activities}/${a.slug}`),
  ];

  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteConfig.url}/${locale}${path}`,
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries([
          ...locales.map((l) => [l, `${siteConfig.url}/${l}${path}`]),
          ["x-default", `${siteConfig.url}/el${path}`],
        ]),
      },
    })),
  );
}
