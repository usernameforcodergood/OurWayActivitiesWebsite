import { Check } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { TextReveal } from "@/components/animations/TextReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";

/**
 * "Design your own trip" — the second way to travel with OurWay. Uses the
 * turquoise accent and a full-height photo so it reads differently from the
 * scheduled-excursions section.
 */
export function PrivateTripsSection({ locale, t }: { locale: Locale; t: Dictionary["home"]["private"] }) {
  return (
    <section aria-labelledby="private-title" className="relative overflow-clip bg-moss text-bone">
      <div className="grid md:grid-cols-12">
        <div className="relative md:col-span-5">
          <ImageReveal
            image="owEverest"
            locale={locale}
            sizes="(min-width: 768px) 42vw, 100vw"
            direction="left"
            parallax={8}
            className="aspect-[4/5] md:sticky md:top-0"
          />
        </div>
        <div className="section-y container-x flex flex-col justify-center md:col-span-7 md:pl-14 lg:pl-20">
          <SectionLabel className="text-lichen">{t.label}</SectionLabel>
          <p className="text-eyebrow mt-6 text-lichen">{t.tagline}</p>
          <TextReveal as="h2" id="private-title" by="words" className="text-display-lg mt-4 max-w-[16ch]">
            {t.title}
          </TextReveal>
          <p className="text-lead mt-8 max-w-xl text-bone/85">{t.body}</p>
          <ul className="mt-10 grid max-w-xl gap-4">
            {t.points.map((p) => (
              <li key={p} className="flex items-start gap-3 border-t border-bone/15 pt-4">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-lichen" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <ButtonLink href={localePath(locale, routes.tailorMade)} className="mt-12 self-start">
            {t.cta}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
