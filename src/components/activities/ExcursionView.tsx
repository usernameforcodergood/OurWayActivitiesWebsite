import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { PublicExcursion } from "@/lib/cms/types";
import { PageHero } from "@/components/ui/PageHero";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { BookingPanel } from "@/components/booking/BookingPanel";

function formatPrice(eur: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "el" ? "el-GR" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: eur % 1 ? 2 : 0,
  }).format(eur);
}

/**
 * Public experience page body — used by the live page and the admin preview,
 * so the preview always matches what visitors will see. Fields that are
 * empty are simply not rendered.
 */
export function ExcursionView({
  excursion,
  locale,
  t,
  preview,
}: {
  excursion: PublicExcursion;
  locale: Locale;
  t: Dictionary;
  /** Admin preview: the booking form is shown but never submits. */
  preview?: boolean;
}) {
  const d = t.activities.detail;
  const facts = (
    [
      [d.destination, excursion.destination],
      [d.category, excursion.category],
      [d.duration, excursion.duration],
      [d.meetingPoint, excursion.meetingPoint],
      [d.difficulty, excursion.difficulty],
      [d.participants, excursion.participants],
      [
        d.price,
        excursion.priceEur !== undefined
          ? [formatPrice(excursion.priceEur, locale), excursion.priceNote].filter(Boolean).join(" · ")
          : excursion.priceNote,
      ],
      [d.availability, excursion.availabilityNote],
    ] as const
  ).filter((f): f is readonly [string, string] => Boolean(f[1]));
  const contactHref = `${localePath(locale, routes.contact)}?interest=${encodeURIComponent(excursion.title)}`;

  return (
    <>
      <PageHero locale={locale} eyebrow={excursion.category ?? (excursion.kind === "event" ? d.eventLabel : t.activities.hero.eyebrow)} title={excursion.title} lead={excursion.summary} image={excursion.cover} />

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
            {excursion.description.length > 0 && (
              <>
                <h2 className="text-display-sm mb-8">{d.overview}</h2>
                <div className="text-lead space-y-6 text-bone/80">
                  {excursion.description.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
              </>
            )}
            {excursion.included.length > 0 && (
              <div className="mt-14">
                <h2 className="text-eyebrow mb-5 font-sans text-lichen">{d.included}</h2>
                <div className="space-y-4 text-bone/80">
                  {excursion.included.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {excursion.info.length > 0 && (
              <div className="mt-14">
                <h2 className="text-eyebrow mb-5 font-sans text-lichen">{d.important}</h2>
                <div className="space-y-4 text-bone/80">
                  {excursion.info.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {excursion.cancellationPolicy.length > 0 && (
              <div className="mt-14">
                <h2 className="text-eyebrow mb-5 font-sans text-lichen">{d.cancellation}</h2>
                <div className="space-y-4 text-sm text-bone/70">
                  {excursion.cancellationPolicy.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
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
              <div className="mt-10">
                <BookingPanel
                  excursion={excursion}
                  locale={locale}
                  t={t.booking}
                  privacyHref={localePath(locale, routes.privacy)}
                  contactHref={contactHref}
                  preview={preview}
                />
              </div>
            </div>
          </aside>
        </div>

        {excursion.gallery.length > 0 && (
          <div className="container-x mt-24">
            <h2 className="text-eyebrow mb-8 font-sans text-fog">{d.gallery}</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-12 md:gap-6">
              {excursion.gallery.map((img, i) => (
                <ImageReveal
                  key={img.src}
                  image={img}
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

