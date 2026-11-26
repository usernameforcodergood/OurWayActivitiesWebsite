import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { buildMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { Hero } from "@/components/sections/Hero";
import { BrandPhilosophy } from "@/components/sections/BrandPhilosophy";
import { StorySection } from "@/components/sections/StorySection";
import { PinnedStorySection } from "@/components/sections/PinnedStorySection";
import { DiscoverSection } from "@/components/sections/DiscoverSection";
import { CTASection } from "@/components/sections/CTASection";
import { FeaturedExcursions } from "@/components/sections/FeaturedExcursions";
import { LatestNews } from "@/components/sections/LatestNews";
import { PrivateTripsSection } from "@/components/sections/PrivateTripsSection";
import { UpcomingEvents } from "@/components/sections/UpcomingEvents";
import { JourneysTeaser } from "@/components/sections/JourneysTeaser";
import { getActiveAnnouncements, getFeaturedExcursions, getUpcomingEvents } from "@/lib/cms/public";
import { getPublishedJourneys } from "@/lib/cms/journeys";

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
  const [featured, news, events, journeys] = await Promise.all([
    getFeaturedExcursions(locale, 3),
    getActiveAnnouncements(locale, 3),
    getUpcomingEvents(locale, 3),
    getPublishedJourneys(locale),
  ]);

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
      {/* 1. Hero */}
      <Hero locale={locale} t={t.home.hero} />
      {/* 2. Who we are */}
      <BrandPhilosophy locale={locale} t={t.home.philosophy} values={t.about.values} />
      {/* 3. What is coming up: real scheduled excursions, soonest available run first */}
      <FeaturedExcursions items={featured} locale={locale} t={t} />
      <UpcomingEvents items={events.items} today={events.today} locale={locale} t={t} />
      {/* 4. What you discover: nature, culture, landscapes, people */}
      <StorySection locale={locale} t={t.home.story} />
      {/* 5. The journey: how a day out unfolds */}
      <PinnedStorySection locale={locale} t={t.home.pinned} />
      {/* 6. Tailor-made */}
      <PrivateTripsSection locale={locale} t={t.home.private} />
      {/* 7. Our Journeys: public archive of trips that really took place (hidden while empty) */}
      <JourneysTeaser items={journeys.slice(0, 3)} locale={locale} t={t.journeys} />
      {/* 8. Gallery / entry points, then announcements */}
      <DiscoverSection locale={locale} t={t.home.discover} />
      <LatestNews items={news} locale={locale} t={t} />
      {/* 9. Closing call to action */}
      <CTASection locale={locale} t={t.home.cta} />
    </>
  );
}
