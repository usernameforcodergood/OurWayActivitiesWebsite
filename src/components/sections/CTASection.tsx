import type { Locale } from "@/i18n/config";
import { localePath, routes } from "@/i18n/routes";
import type { MediaKey } from "@/content/media";
import { ParallaxBackground } from "@/components/animations/ParallaxBackground";
import { TextReveal } from "@/components/animations/TextReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";

type Props = {
  locale: Locale;
  t: { label: string; title: string; body: string; button: string };
  image?: MediaKey;
  href?: string;
};

/** Closing invitation — reused on every page that ends in an inquiry. */
export function CTASection({ locale, t, image = "coastCliff", href }: Props) {
  return (
    <section aria-labelledby="cta-title" className="relative overflow-hidden bg-ink text-bone">
      <ParallaxBackground image={image} locale={locale} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/30" />
      <div className="container-x relative flex min-h-[85svh] flex-col justify-end py-24 md:py-32">
        <SectionLabel className="text-bone/80">{t.label}</SectionLabel>
        <TextReveal as="h2" id="cta-title" by="words" className="text-display-xl mt-8 max-w-[13ch]">
          {t.title}
        </TextReveal>
        <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="text-lead max-w-lg text-bone/85">{t.body}</p>
          <ButtonLink href={href ?? localePath(locale, routes.contact)} className="self-start md:self-auto">
            {t.button}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
