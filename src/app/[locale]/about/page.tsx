import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";
import { TextReveal } from "@/components/animations/TextReveal";
import { ScrubText } from "@/components/animations/ScrubText";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { ExpandingImage } from "@/components/animations/ExpandingImage";
import { pad } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.about, ...t.meta.pages.about });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const a = t.about;

  return (
    <>
      <PageHero locale={locale} eyebrow={a.hero.eyebrow} title={a.hero.title} lead={a.hero.lead} image="stoneBridge" />

      {/* The name */}
      <section aria-labelledby="meaning-title" className="section-y bg-ink text-bone">
        <div className="container-x grid gap-12 md:grid-cols-12">
          <SectionLabel index="01" className="text-fog md:col-span-3">
            {a.meaningLabel}
          </SectionLabel>
          <div className="md:col-span-8 md:col-start-5">
            <TextReveal as="h2" id="meaning-title" className="text-display-md">
              {a.meaningTitle}
            </TextReveal>
            <div className="mt-10 space-y-6 text-lead text-bone/80">
              {a.meaningBody.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section aria-labelledby="values-title" className="on-light section-y bg-stone text-ink">
        <div className="container-x">
          <SectionLabel index="02" className="text-bark">
            {a.valuesLabel}
          </SectionLabel>
          <h2 id="values-title" className="sr-only">
            {a.valuesLabel}
          </h2>
          <ul className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {a.values.map((v, i) => (
              <li key={v.title} className={i % 2 ? "lg:mt-20" : ""}>
                <p className="font-display text-6xl text-clay/70">{pad(i + 1)}</p>
                <h3 className="text-display-sm mt-6 border-t border-ink/15 pt-6">{v.title}</h3>
                <p className="mt-3 text-bark">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Nature + culture */}
      <section className="bg-stone pb-0">
        <ExpandingImage image="folkDanceCircle" locale={locale} label={a.natureCultureTitle} index={3}>
          <ScrubText as="p" text={a.natureCultureBody} className="font-display text-display-sm max-w-4xl text-bone" />
        </ExpandingImage>
      </section>

      {/* Evolving */}
      <section aria-labelledby="evolving-title" className="section-y bg-ink text-bone">
        <div className="container-x grid items-center gap-12 md:grid-cols-12">
          <ImageReveal
            image="oliveTrail"
            locale={locale}
            sizes="(min-width: 768px) 40vw, 100vw"
            direction="left"
            parallax={8}
            className="aspect-[4/5] md:col-span-5"
          />
          <div className="md:col-span-5 md:col-start-8">
            <SectionLabel index="04" className="text-fog">
              {a.evolvingLabel}
            </SectionLabel>
            <TextReveal as="h2" id="evolving-title" className="text-display-md mt-8">
              {a.evolvingTitle}
            </TextReveal>
            <p className="text-lead mt-6 text-bone/80">{a.evolvingBody}</p>
            <ButtonLink href={localePath(locale, routes.contact)} className="mt-10">
              {a.evolvingCta}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
