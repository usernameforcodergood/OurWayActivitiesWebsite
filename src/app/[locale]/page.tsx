import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { buildMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { Hero } from "@/components/sections/Hero";
import { BrandPhilosophy } from "@/components/sections/BrandPhilosophy";
import { StorySection } from "@/components/sections/StorySection";
import { ExperienceShowcase } from "@/components/sections/ExperienceShowcase";
import { PinnedStorySection } from "@/components/sections/PinnedStorySection";
import { DiscoverSection } from "@/components/sections/DiscoverSection";
import { CTASection } from "@/components/sections/CTASection";
import { FeaturedExcursions } from "@/components/sections/FeaturedExcursions";
import { LatestNews } from "@/components/sections/LatestNews";
import { getActiveAnnouncements, getFeaturedExcursions } from "@/lib/cms/public";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({
    locale,
    path: "",
    title: t.meta.pages.home.title,
    description: t.meta.pages.home.description,
    absoluteTitle: true,
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const [featured, news] = await Promise.all([getFeaturedExcursions(locale, 3), getActiveAnnouncements(locale, 3)]);

  // Only facts that are confirmed: the name and the website.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero locale={locale} t={t.home.hero} />
      <BrandPhilosophy locale={locale} t={t.home.philosophy} />
      <StorySection locale={locale} t={t.home.story} />
      <ExperienceShowcase locale={locale} t={t.home.showcase} />
      <FeaturedExcursions items={featured} locale={locale} t={t} />
      <PinnedStorySection locale={locale} t={t.home.pinned} />
      <DiscoverSection locale={locale} t={t.home.discover} />
      <LatestNews items={news} locale={locale} t={t} />
      <CTASection locale={locale} t={t.home.cta} />
    </>
  );
}
