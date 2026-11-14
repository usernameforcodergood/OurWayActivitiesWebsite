import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { getActiveAnnouncement, getActiveAnnouncements } from "@/lib/cms/public";
import { AnnouncementView } from "@/components/news/AnnouncementView";

const NO_CONTENT = "_";

export async function generateStaticParams() {
  const slugs = [...new Set([...(await getActiveAnnouncements("el")), ...(await getActiveAnnouncements("en"))].map((a) => a.slug))];
  const list = slugs.length ? slugs : [NO_CONTENT];
  return locales.flatMap((locale) => list.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/news/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};
  const item = await getActiveAnnouncement(slug, locale);
  if (!item || !item.locales.includes(locale)) return {};
  const base = buildMetadata({
    locale,
    path: `${routes.news}/${slug}`,
    title: item.title,
    description: item.summary,
    image: item.image ? { src: item.image.src, alt: item.image.alt } : undefined,
  });
  const languages = Object.fromEntries(
    Object.entries(base.alternates?.languages ?? {}).filter(([lang]) =>
      lang === "x-default" ? item.locales.includes("el") : item.locales.includes(lang as "el" | "en"),
    ),
  );
  return { ...base, alternates: { ...base.alternates, languages } };
}

export default async function AnnouncementPage({ params }: PageProps<"/[locale]/news/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const item = await getActiveAnnouncement(slug, locale);
  if (!item) notFound();
  if (!item.locales.includes(locale)) redirect(localePath(locale, routes.news));
  const t = await getDictionary(locale);
  return <AnnouncementView item={item} locale={locale} t={t} />;
}
