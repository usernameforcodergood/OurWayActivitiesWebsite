import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Crawling stays allowed even before launch: a crawler has to fetch a page
  // to see its "noindex" tag. Only the sitemap is withheld until launch.
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    ...(siteConfig.indexable && { sitemap: `${siteConfig.url}/sitemap.xml`, host: siteConfig.url }),
  };
}
