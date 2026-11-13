import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { media } from "@/content/media";
import { getActivity, getAllActivitySlugs } from "@/content/activities";
import { PageHero } from "@/components/ui/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { ImageReveal } from "@/components/animations/ImageReveal";

export function generateStaticParams() {
  return locales.flatMap((locale) => getAllActivitySlugs().map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/activities/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const activity = getActivity(slug);
  if (!hasLocale(locale) || !activity) return {};
  return buildMetadata({
    locale,
    path: `${routes.activities}/${slug}`,
    title: activity.title[locale],
    description: activity.summary[locale],
    image: {
      src: media[activity.image].src.replace(/\?.*$/, "?auto=format&fit=crop&w=1200&h=630&q=75"),
      alt: media[activity.image].alt[locale],
    },
    noIndex: activity.status !== "published",
  });
}

export default async function ActivityPage({ params }: PageProps<"/[locale]/activities/[slug]">) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();
  const activity = getActivity(slug);
  if (!activity) notFound();
  const t = await getDictionary(locale);
  const d = t.activities.detail;

  // Only fields that exist are shown — nothing is ever invented or left blank.
  const facts = (
    [
      [d.location, activity.location?.[locale]],
      [d.type, activity.experienceType?.[locale]],
      [d.duration, activity.duration?.[locale]],
      [d.difficulty, activity.difficulty?.[locale]],
      [d.groupSize, activity.groupSize?.[locale]],
      [d.availability, activity.availability?.[locale]],
    ] as const
  ).filter((f): f is readonly [string, string] => Boolean(f[1]));
  const included = activity.included?.[locale] ?? [];
  const important = activity.importantInfo?.[locale] ?? [];
  const description = activity.description?.[locale] ?? [];
  const gallery = activity.gallery ?? [];
  const contactHref = `${localePath(locale, routes.contact)}?interest=${encodeURIComponent(activity.title[locale])}`;

  return (
    <>
      {activity.status === "draft" && (
        <p role="note" className="fixed inset-x-0 bottom-0 z-40 bg-sand px-4 py-2 text-center text-sm font-semibold text-ink">
          {t.common.draftBanner}
        </p>
      )}
      <PageHero locale={locale} eyebrow={t.activities.hero.eyebrow} title={activity.title[locale]} lead={activity.summary[locale]} image={activity.image} />

      <section className="section-y bg-ink text-bone">
        <div className="container-x grid gap-16 md:grid-cols-12">
          <div className="md:col-span-7">
            <Link
              href={localePath(locale, routes.activities)}
              className="text-eyebrow mb-12 inline-flex min-h-11 items-center gap-2 text-fog hover:text-bone"
            >
              <ArrowLeft aria-hidden className="size-4" />
              {d.back}
            </Link>
            {description.length > 0 && (
              <>
                <h2 className="text-display-sm mb-8">{d.overview}</h2>
                <div className="space-y-6 text-lead text-bone/80">
                  {description.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </>
            )}
            {important.length > 0 && (
              <div className="mt-14">
                <h2 className="text-eyebrow mb-5 font-sans text-lichen">{d.important}</h2>
                <ul className="list-disc space-y-2 pl-5 text-bone/80">
                  {important.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="md:col-span-4 md:col-start-9">
            <div className="md:sticky md:top-28">
              {facts.length > 0 && (
                <>
                  <h2 className="text-eyebrow mb-4 font-sans text-fog">{d.details}</h2>
                  <dl className="border-t border-bone/15">
                    {facts.map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-6 border-b border-bone/15 py-4">
                        <dt className="text-fog">{label}</dt>
                        <dd className="text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {included.length > 0 && (
                <div className="mt-10">
                  <h2 className="text-eyebrow mb-4 font-sans text-fog">{d.included}</h2>
                  <ul className="space-y-2 text-bone/85">
                    {included.map((i) => (
                      <li key={i}>— {i}</li>
                    ))}
                  </ul>
                </div>
              )}
              {activity.bookingEnabled !== false && (
                <div className="mt-10 rounded-sm bg-forest p-8">
                  <p className="text-display-sm">{d.inquireTitle}</p>
                  <p className="mt-3 text-fog">{d.inquireBody}</p>
                  <ButtonLink href={contactHref} className="mt-6">
                    {d.inquireCta}
                  </ButtonLink>
                </div>
              )}
            </div>
          </aside>
        </div>

        {gallery.length > 0 && (
          <div className="container-x mt-24">
            <h2 className="text-eyebrow mb-8 font-sans text-fog">{d.gallery}</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-12 md:gap-6">
              {gallery.map((key, i) => (
                <ImageReveal
                  key={key}
                  image={key}
                  locale={locale}
                  sizes="(min-width: 768px) 40vw, 100vw"
                  direction={i % 2 ? "right" : "left"}
                  className={i % 3 === 0 ? "aspect-[4/3] md:col-span-7" : "aspect-[4/3] md:col-span-5"}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
