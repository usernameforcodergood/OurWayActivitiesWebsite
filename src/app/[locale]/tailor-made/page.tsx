import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, Flag, Heart, Mountain, TreePine, Users } from "lucide-react";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { pad } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { TextReveal } from "@/components/animations/TextReveal";
import { TailorMadeForm } from "@/components/forms/TailorMadeForm";

export async function generateMetadata({ params }: PageProps<"/[locale]/tailor-made">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.tailorMade, ...t.meta.pages.tailorMade });
}

/** One icon per audience, in the order of `tailorMade.audience.items`. */
const AUDIENCE_ICONS = [Users, TreePine, Heart, Briefcase, Flag, Mountain];

/** Tailor-Made Experiences: what we design, for whom, how — and the request form. */
export default async function TailorMadePage({ params }: PageProps<"/[locale]/tailor-made">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const p = t.tailorMade;

  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={p.hero.eyebrow}
        title={p.hero.title}
        lead={p.hero.lead}
        image="ridgeAutumn"
        actions={<ButtonLink href="#plan">{p.hero.cta}</ButtonLink>}
      />

      {/* Who we design for */}
      <section aria-labelledby="audience-title" className="section-y bg-ink text-bone">
        <div className="container-x">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <SectionLabel className="text-fog">{p.audience.label}</SectionLabel>
              <TextReveal as="h2" id="audience-title" by="words" className="text-display-md mt-6">
                {p.audience.title}
              </TextReveal>
            </div>
            <p className="text-lead self-end text-bone/75 md:col-span-6 md:col-start-7">{p.audience.intro}</p>
          </div>

          <ul className="mt-16 grid gap-px overflow-hidden border border-bone/10 bg-bone/10 sm:grid-cols-2 lg:grid-cols-3 md:mt-24">
            {p.audience.items.map((a, i) => {
              const Icon = AUDIENCE_ICONS[i] ?? Users;
              return (
                <li key={a.title} className="group relative bg-ink p-8 transition-colors duration-500 hover:bg-forest sm:p-10">
                  <div className="flex items-start justify-between">
                    <Icon aria-hidden className="size-7 text-mint transition-transform duration-500 ease-out-expo group-hover:-translate-y-1" strokeWidth={1.4} />
                    <span className="text-xs tabular-nums text-fog">{pad(i + 1)}</span>
                  </div>
                  <h3 className="font-display mt-10 text-2xl leading-tight">{a.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-bone/70">{a.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Not just hiking */}
      <section aria-labelledby="kinds-title" className="relative overflow-hidden bg-moss text-bone">
        <div className="grid md:grid-cols-12">
          <div className="section-y container-x flex flex-col justify-center md:order-1 md:col-span-7 md:pr-14 lg:pr-20">
            <SectionLabel className="text-mint">{p.kinds.label}</SectionLabel>
            <TextReveal as="h2" id="kinds-title" by="words" className="text-display-lg mt-6 max-w-[14ch]">
              {p.kinds.title}
            </TextReveal>
            <p className="text-lead mt-8 max-w-xl text-bone/85">{p.kinds.body}</p>
            <ul className="mt-10 flex max-w-xl flex-wrap gap-2.5">
              {p.kinds.items.map((k) => (
                <li key={k} className="rounded-full border border-bone/25 px-4 py-2 text-sm text-bone/90 transition-colors duration-500 hover:border-turquoise hover:text-turquoise">
                  {k}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative md:order-2 md:col-span-5">
            <ImageReveal
              image="folkDanceCircle"
              locale={locale}
              sizes="(min-width: 768px) 42vw, 100vw"
              direction="right"
              parallax={8}
              className="aspect-[4/3] h-full md:aspect-auto md:min-h-[38rem]"
            />
          </div>
        </div>
      </section>

      {/* How it works + request form */}
      <section id="plan" aria-label={p.form.title} className="scroll-mt-[var(--header-h)] bg-ink pb-[var(--section-y)] pt-16 text-bone md:pt-24">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-10">
          <aside className="lg:col-span-4">
            <ImageReveal image="sittingGorge" locale={locale} sizes="(min-width: 1024px) 30vw, 100vw" direction="up" className="aspect-[4/3] lg:aspect-[4/5]" />
            <h2 className="text-eyebrow mt-12 font-sans text-fog">{p.stepsTitle}</h2>
            <ol className="mt-6 space-y-6">
              {p.steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-3 border-t border-bone/15 pt-5">
                  <span className="text-sm tabular-nums text-mint">{pad(i + 1)}</span>
                  <div>
                    <p className="font-display text-2xl">{s.title}</p>
                    <p className="mt-1 text-sm text-fog">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <div className="on-light bg-limestone p-6 sm:p-10 lg:col-span-8 lg:p-14">
            <TailorMadeForm
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
