import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { getPublishedJourneys } from "@/lib/cms/journeys";
import { PageHero } from "@/components/ui/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { JourneyBrowser } from "@/components/journeys/JourneyBrowser";

export async function generateMetadata({ params }: PageProps<"/[locale]/journeys">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.journeys, ...t.meta.pages.journeys });
}

export default async function JourneysPage({ params }: PageProps<"/[locale]/journeys">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const j = t.journeys;
  const items = await getPublishedJourneys(locale);

  return (
    <>
      <PageHero locale={locale} eyebrow={j.label} title={j.title} lead={j.intro} image={items[0]?.cover ?? "ridgeAutumn"} />
      <section aria-labelledby="journeys-list" className="section-y bg-ink text-bone">
        <div className="container-x">
          <h2 id="journeys-list" className="sr-only">
            {j.title}
          </h2>
          {items.length > 0 ? (
            <JourneyBrowser items={items} locale={locale} t={j} categories={t.activities.filters.categories} />
          ) : (
            <div className="mt-10 max-w-2xl border-t border-bone/15 pt-10">
              <p className="text-display-sm">{j.empty.title}</p>
              <p className="text-lead mt-4 text-fog">{j.empty.body}</p>
              <ButtonLink href={localePath(locale, routes.activities)} className="mt-8">
                {j.empty.cta}
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
