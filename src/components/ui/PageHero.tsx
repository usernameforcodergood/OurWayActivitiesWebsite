import type { Locale } from "@/i18n/config";
import type { MediaKey } from "@/content/media";
import { TextReveal } from "@/components/animations/TextReveal";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { SectionLabel } from "./SectionLabel";

type Props = {
  locale: Locale;
  eyebrow: string;
  title: string;
  lead?: string;
  image?: MediaKey;
};

/** Shared opening for inner pages: editorial title, lead, wide image reveal. */
export function PageHero({ locale, eyebrow, title, lead, image }: Props) {
  return (
    <section className="bg-ink pt-[calc(var(--header-h)+clamp(3rem,10vw,8rem))] text-bone">
      <div className="container-x grid gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-8">
          <SectionLabel className="text-fog">{eyebrow}</SectionLabel>
          <TextReveal as="h1" trigger="mount" delay={0.1} className="text-display-lg mt-8 max-w-[15ch]">
            {title}
          </TextReveal>
        </div>
        {lead && <p className="text-lead text-bone/80 md:col-span-4">{lead}</p>}
      </div>
      {image && (
        <div className="container-x mt-16 md:mt-24">
          <ImageReveal
            image={image}
            locale={locale}
            priority
            sizes="(min-width: 1536px) 1440px, 100vw"
            direction="up"
            parallax={10}
            className="aspect-[4/3] md:aspect-[21/9]"
          />
        </div>
      )}
    </section>
  );
}
