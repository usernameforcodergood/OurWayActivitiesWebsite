import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { ScrubText } from "@/components/animations/ScrubText";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { TextReveal } from "@/components/animations/TextReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";
import { pad } from "@/lib/utils";

type Props = {
  locale: Locale;
  t: Dictionary["home"]["philosophy"];
  /** The same values the Philosophy page lists, so both stay in step. */
  values: Dictionary["about"]["values"];
};

/**
 * Section 2 — "Our philosophy", condensed from the Philosophy page: what the
 * name means, the difference between visiting a place and living it, and the
 * four values. Continues the hero's dark ink so the hand-over is seamless.
 */
export function BrandPhilosophy({ locale, t, values }: Props) {
  return (
    <section id="philosophy" aria-labelledby="philosophy-title" className="section-y relative scroll-mt-0 bg-ink text-bone">
      <div className="container-x grid gap-y-14 md:grid-cols-12 md:gap-x-8">
        <div className="grid gap-6 md:col-span-12 md:grid-cols-12 md:items-baseline md:gap-8">
          <SectionLabel index="01" className="text-fog md:col-span-4">
            <span id="philosophy-title">{t.label}</span>
          </SectionLabel>
          <p className="max-w-md font-display text-lg italic leading-snug text-turquoise md:col-span-6 md:col-start-7 md:text-xl">
            {t.intro}
          </p>
        </div>

        <ScrubText
          text={t.statement}
          className="font-display text-display-md md:col-span-11 lg:col-span-10"
        />

        <div className="grid gap-10 md:col-span-12 md:grid-cols-12 md:items-end md:gap-8">
          <ImageReveal
            image="sittingGorge"
            locale={locale}
            sizes="(min-width: 768px) 30vw, 70vw"
            direction="up"
            parallax={8}
            className="aspect-[4/5] w-[70%] rounded-sm md:col-span-4 md:col-start-2 md:w-full"
          />
          <div className="md:col-span-5 md:col-start-7 md:pb-4">
            <p className="text-lead text-bone/80">{t.aside}</p>
            <ButtonLink href={localePath(locale, routes.about)} variant="text" className="mt-8 text-turquoise">
              {t.link}
            </ButtonLink>
          </div>
        </div>

        <div className="mt-6 border-t border-bone/10 pt-14 md:col-span-12 md:mt-10 md:pt-20">
          <TextReveal as="h3" className="text-eyebrow font-sans text-fog">
            {t.valuesLabel}
          </TextReveal>
          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <li key={v.title} className={i % 2 ? "lg:mt-12" : ""}>
                <p aria-hidden className="font-display text-5xl text-mint/50">
                  {pad(i + 1)}
                </p>
                <h4 className="text-display-sm mt-5 font-display border-t border-bone/15 pt-5">{v.title}</h4>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-bone/70">{v.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
