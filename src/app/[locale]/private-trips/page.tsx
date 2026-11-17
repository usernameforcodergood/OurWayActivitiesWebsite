import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { pad } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { PrivateTripForm } from "@/components/forms/PrivateTripForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/private-trips">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.privateTrips, ...t.meta.pages.privateTrips });
}

/** Private group trips: how it works + the request form. */
export default async function PrivateTripsPage({ params }: PageProps<"/[locale]/private-trips">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const p = t.privateTrips;

  return (
    <>
      <PageHero locale={locale} eyebrow={p.hero.eyebrow} title={p.hero.title} lead={p.hero.lead} />

      <section className="bg-ink pb-[var(--section-y)] pt-16 text-bone md:pt-24">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-10">
          <aside className="lg:col-span-4">
            <ImageReveal image="sittingGorge" locale={locale} sizes="(min-width: 1024px) 30vw, 100vw" direction="up" className="aspect-[4/3] lg:aspect-[4/5]" />
            <h2 className="text-eyebrow mt-12 font-sans text-fog">{p.stepsTitle}</h2>
            <ol className="mt-6 space-y-6">
              {p.steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-3 border-t border-bone/15 pt-5">
                  <span className="text-sm tabular-nums text-lichen">{pad(i + 1)}</span>
                  <div>
                    <p className="font-display text-2xl">{s.title}</p>
                    <p className="mt-1 text-sm text-fog">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <div className="on-light bg-limestone p-6 sm:p-10 lg:col-span-8 lg:p-14">
            <PrivateTripForm
              locale={locale}
              t={p.form}
              common={t.booking.form}
              notBooking={p.notBooking}
              privacyHref={localePath(locale, routes.privacy)}
            />
          </div>
        </div>
      </section>
    </>
  );
}
