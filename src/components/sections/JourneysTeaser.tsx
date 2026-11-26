import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { PublicJourney } from "@/lib/cms/types";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextReveal } from "@/components/animations/TextReveal";
import { JourneyCard } from "@/components/journeys/JourneyCard";

/** Homepage: the latest trips that really took place. Renders nothing until one is published. */
export function JourneysTeaser({ items, locale, t }: { items: PublicJourney[]; locale: Locale; t: Dictionary["journeys"] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="journeys-title" className="section-y bg-ink text-bone">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel className="text-fog">{t.label}</SectionLabel>
            <TextReveal as="h2" id="journeys-title" className="text-display-lg mt-8 max-w-[16ch]">
              {t.teaserTitle}
            </TextReveal>
            <p className="text-lead mt-6 max-w-xl text-fog">{t.intro}</p>
          </div>
          <Link href={localePath(locale, routes.journeys)} className="group inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-turquoise">
            {t.all}
            <ArrowUpRight aria-hidden className="size-4 transition-transform duration-500 group-hover:rotate-45" />
          </Link>
        </div>
        <div className={`mt-16 grid gap-x-8 gap-y-16 ${items.length === 1 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {items.map((j) => (
            <JourneyCard key={j.slug} journey={j} locale={locale} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
