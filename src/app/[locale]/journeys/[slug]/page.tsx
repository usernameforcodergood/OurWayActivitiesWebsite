import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, MapPin } from "lucide-react";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { formatDayRange } from "@/lib/bookings/format";
import { getPublishedJourney, getPublishedJourneySlugs } from "@/lib/cms/journeys";
import { PageHero } from "@/components/ui/PageHero";
import { RichText } from "@/components/ui/RichText";
import { ButtonLink } from "@/components/ui/Button";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";

/** Placeholder so the route is always statically known; it simply 404s. */
const NO_CONTENT = "_";

export async function generateStaticParams() {
  const slugs = await getPublishedJourneySlugs();
  const list = slugs.length ? slugs : [NO_CONTENT];
  return locales.flatMap((locale) => list.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/journeys/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) return {};
  const j = await getPublishedJourney(slug, locale);
  if (!j || !j.locales.includes(locale)) return {};
  const base = buildMetadata({
    locale,
    path: `${routes.journeys}/${slug}`,
    title: j.title,
    description: j.summary,
    image: j.cover ? { src: j.cover.src, alt: j.cover.alt } : undefined,
  });
  // Only advertise language versions that actually exist.
  const languages = Object.fromEntries(
    Object.entries(base.alternates?.languages ?? {}).filter(([lang]) =>
      lang === "x-default" ? j.locales.includes("el") : j.locales.includes(lang as "el" | "en"),
    ),
  );
  return { ...base, alternates: { ...base.alternates, languages } };
}

export default async function JourneyPage({ params }: PageProps<"/[locale]/journeys/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const journey = await getPublishedJourney(slug, locale);
  if (!journey) notFound();
  // Not written in this language yet: back to the list rather than a half-translated page.
  if (!journey.locales.includes(locale)) redirect(localePath(locale, routes.journeys));
  const t = await getDictionary(locale);
  const j = t.journeys;
  const photos = journey.gallery.length ? journey.gallery : journey.cover ? [journey.cover] : [];

  return (
    <>
      <PageHero locale={locale} eyebrow={j.label} title={journey.title} lead={journey.summary} image={journey.cover} />

      <article className="bg-ink pb-[var(--section-y)] pt-16 text-bone md:pt-24">
        <div className="container-x">
          <Link href={localePath(locale, routes.journeys)} className="inline-flex min-h-11 items-center gap-2 text-sm text-fog hover:text-bone">
            <ArrowLeft aria-hidden className="size-4" />
            {j.back}
          </Link>

          <dl className="mt-8 grid gap-6 border-y border-bone/15 py-8 sm:grid-cols-3">
            <div>
              <dt className="text-eyebrow text-fog">{j.date}</dt>
              <dd className="mt-2 flex items-center gap-2 font-semibold">
                <CalendarDays aria-hidden className="size-4 text-turquoise" />
                <time dateTime={journey.date}>{formatDayRange(journey.date, journey.dateUntil, locale)}</time>
              </dd>
            </div>
            {journey.location && (
              <div>
                <dt className="text-eyebrow text-fog">{j.location}</dt>
                <dd className="mt-2 flex items-center gap-2 font-semibold">
                  <MapPin aria-hidden className="size-4 text-turquoise" />
                  {journey.location}
                </dd>
              </div>
            )}
            <div>
              <dt className="sr-only">{j.label}</dt>
              <dd className="inline-flex items-center gap-2 rounded-full bg-turquoise/15 px-4 py-2 text-sm font-semibold text-turquoise">
                <CheckCircle2 aria-hidden className="size-4" />
                {j.completed}
              </dd>
            </div>
          </dl>

          {(journey.description || journey.quote) && (
            <div className="mt-16 grid gap-12 md:grid-cols-12 md:gap-8">
              {journey.description && (
                <div className="md:col-span-7">
                  <RichText value={journey.description} className="text-lead text-bone/80" />
                </div>
              )}
              {journey.quote && (
                <blockquote className="border-l-2 border-turquoise pl-6 md:col-span-4 md:col-start-9">
                  <p className="font-display text-display-sm italic leading-snug text-bone">“{journey.quote}”</p>
                </blockquote>
              )}
            </div>
          )}

          {photos.length > 0 && (
            <section aria-labelledby="journey-gallery" className="mt-24">
              <h2 id="journey-gallery" className="text-eyebrow mb-8 font-sans text-fog">
                {j.gallery}
              </h2>
              <GalleryGrid items={photos} locale={locale} t={t.gallery} />
            </section>
          )}

          <div className="mt-24 grid gap-8 border-t border-bone/15 pt-12 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <p className="text-display-md">{j.next.title}</p>
              <p className="text-lead mt-4 text-fog">{j.next.body}</p>
            </div>
            <div className="flex flex-col items-start gap-4 md:col-span-5 md:items-end">
              <ButtonLink href={localePath(locale, routes.activities)}>{j.next.button}</ButtonLink>
              {journey.excursionSlug && (
                <Link
                  href={localePath(locale, `${routes.activities}/${journey.excursionSlug}`)}
                  className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-turquoise"
                >
                  {j.experienceLink}
                  <ArrowUpRight aria-hidden className="size-4 transition-transform duration-500 group-hover:rotate-45" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
