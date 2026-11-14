import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { getPublishedExcursion, getPublishedExcursionSlugs } from "@/lib/cms/public";
import { ExcursionView } from "@/components/activities/ExcursionView";

/** Placeholder so the route is always statically known; it simply 404s. */
const NO_CONTENT = "_";

export async function generateStaticParams() {
  const slugs = await getPublishedExcursionSlugs();
  const list = slugs.length ? slugs : [NO_CONTENT];
  return locales.flatMap((locale) => list.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/activities/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};
  const ex = await getPublishedExcursion(slug, locale);
  if (!ex || !ex.locales.includes(locale)) return {};
  const base = buildMetadata({
    locale,
    path: `${routes.activities}/${slug}`,
    title: ex.title,
    description: ex.summary,
    image: ex.cover ? { src: ex.cover.src, alt: ex.cover.alt } : undefined,
  });
  // Only advertise language versions that actually exist.
  const languages = Object.fromEntries(
    Object.entries(base.alternates?.languages ?? {}).filter(([lang]) =>
      lang === "x-default" ? ex.locales.includes("el") : ex.locales.includes(lang as "el" | "en"),
    ),
  );
  return { ...base, alternates: { ...base.alternates, languages } };
}

export default async function ExcursionPage({ params }: PageProps<"/[locale]/activities/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const excursion = await getPublishedExcursion(slug, locale);
  if (!excursion) notFound();
  // Not translated into this language yet: send visitors to the list instead
  // of showing an incomplete page.
  if (!excursion.locales.includes(locale)) redirect(localePath(locale, routes.activities));
  const t = await getDictionary(locale);
  return <ExcursionView excursion={excursion} locale={locale} t={t} />;
}
