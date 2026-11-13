import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import type { MediaKey } from "@/content/media";
import { getDestinations } from "@/content/destinations";
import { PageHero } from "@/components/ui/PageHero";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { TextReveal } from "@/components/animations/TextReveal";
import { CTASection } from "@/components/sections/CTASection";
import { cn, pad } from "@/lib/utils";

/** One image per landscape type (by position in the message file). */
const LANDSCAPE_IMAGES: MediaKey[] = ["valleyVillage", "riverForest", "coastCliff", "sheepMountain"];

export async function generateMetadata({ params }: PageProps<"/[locale]/destinations">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.destinations, ...t.meta.pages.destinations });
}

export default async function DestinationsPage({ params }: PageProps<"/[locale]/destinations">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const d = t.destinations;
  const confirmed = getDestinations();

  return (
    <>
      <PageHero locale={locale} eyebrow={d.hero.eyebrow} title={d.hero.title} lead={d.hero.lead} />

      <section aria-labelledby="landscapes-title" className="section-y bg-ink pt-16 text-bone md:pt-24">
        <div className="container-x">
          <div className="grid gap-8 md:grid-cols-12">
            <SectionLabel className="text-fog md:col-span-4">{d.landscapesLabel}</SectionLabel>
            <p id="landscapes-title" className="text-lead text-bone/80 md:col-span-6 md:col-start-7">
              {d.intro}
            </p>
          </div>

          <div className="mt-20 space-y-28 md:mt-32 md:space-y-44">
            {d.landscapes.map((l, i) => {
              const flip = i % 2 === 1;
              return (
                <article key={l.title} className="grid items-center gap-10 md:grid-cols-12 md:gap-8">
                  <ImageReveal
                    image={LANDSCAPE_IMAGES[i]}
                    locale={locale}
                    sizes="(min-width: 768px) 58vw, 100vw"
                    direction={flip ? "right" : "left"}
                    parallax={8}
                    className={cn(
                      "aspect-[4/3]",
                      flip ? "md:order-2 md:col-span-7 md:col-start-6" : "md:col-span-7",
                      i === 2 && "md:aspect-[16/9]",
                    )}
                  />
                  <div className={cn(flip ? "md:order-1 md:col-span-4 md:col-start-1" : "md:col-span-4 md:col-start-9")}>
                    <p className="text-eyebrow mb-6 tabular-nums text-lichen">{pad(i + 1)}</p>
                    <TextReveal as="h2" className="text-display-md">
                      {l.title}
                    </TextReveal>
                    <p className="text-lead mt-6 text-bone/75">{l.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {confirmed.length > 0 && (
        <section aria-labelledby="destinations-list" className="on-light section-y bg-stone text-ink">
          <div className="container-x">
            <SectionLabel className="text-bark">{d.listLabel}</SectionLabel>
            <h2 id="destinations-list" className="sr-only">
              {d.listLabel}
            </h2>
            <ul className="mt-12 grid gap-12 md:grid-cols-3">
              {confirmed.map((dest) => (
                <li key={dest.slug}>
                  <ImageReveal image={dest.image} locale={locale} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[4/5]" />
                  <h3 className="text-display-sm mt-6">{dest.name[locale]}</h3>
                  {dest.region && <p className="text-eyebrow mt-2 text-bark">{dest.region[locale]}</p>}
                  <p className="mt-3 text-bark">{dest.summary[locale]}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CTASection locale={locale} t={{ label: d.landscapesLabel, title: d.ctaTitle, body: d.ctaBody, button: d.cta }} image="canyonAutumn" />
    </>
  );
}
