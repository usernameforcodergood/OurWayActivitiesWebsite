import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { PublicExcursion } from "@/lib/cms/types";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextReveal } from "@/components/animations/TextReveal";
import { ExperienceCard } from "@/components/activities/ExperienceCard";

/** Published (featured first) experiences from the CMS. Renders nothing when empty. */
export function FeaturedExcursions({ items, locale, t }: { items: PublicExcursion[]; locale: Locale; t: Dictionary }) {
  if (!items.length) return null;
  const f = t.home.featured;
  return (
    <section aria-labelledby="featured-title" className="section-y border-t border-bone/10 bg-ink text-bone">
      <div className="container-x">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel className="text-fog">{f.label}</SectionLabel>
            <TextReveal as="h2" id="featured-title" className="text-display-lg mt-8 max-w-[16ch]">
              {f.title}
            </TextReveal>
          </div>
          <Link href={localePath(locale, routes.activities)} className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lichen">
            {f.all}
            <ArrowUpRight aria-hidden className="size-4 transition-transform duration-500 group-hover:rotate-45" />
          </Link>
        </div>
        <div className={`mt-16 grid gap-x-8 gap-y-16 ${items.length === 1 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {items.map((ex, i) => (
            <ExperienceCard key={ex.slug} excursion={ex} locale={locale} index={i} cta={t.activities.viewExperience} layout="column" />
          ))}
        </div>
      </div>
    </section>
  );
}
