import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { ScrubText } from "@/components/animations/ScrubText";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";

/** Section 2 — the difference between visiting a place and living it. */
export function BrandPhilosophy({ locale, t }: { locale: Locale; t: Dictionary["home"]["philosophy"] }) {
  return (
    <section id="philosophy" aria-label={t.label} className="section-y relative scroll-mt-0 bg-ink text-bone">
      <div className="container-x grid gap-y-14 md:grid-cols-12 md:gap-x-8">
        <SectionLabel index="01" className="text-fog md:col-span-12">
          {t.label}
        </SectionLabel>

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
            <ButtonLink href={localePath(locale, routes.about)} variant="text" className="mt-8 text-lichen">
              {t.link}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
