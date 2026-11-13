import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { getActivities } from "@/content/activities";
import { PageHero } from "@/components/ui/PageHero";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";
import { TextReveal } from "@/components/animations/TextReveal";
import { ExperienceCard } from "@/components/activities/ExperienceCard";
import { CTASection } from "@/components/sections/CTASection";
import { pad } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/activities">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.activities, ...t.meta.pages.activities });
}

export default async function ActivitiesPage({ params }: PageProps<"/[locale]/activities">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const a = t.activities;
  const list = getActivities();

  return (
    <>
      <PageHero locale={locale} eyebrow={a.hero.eyebrow} title={a.hero.title} lead={a.hero.lead} image="roadPause" />

      {list.length > 0 && (
        <section aria-labelledby="list-title" className="section-y bg-ink text-bone">
          <div className="container-x">
            <SectionLabel className="text-fog">{a.listTitle}</SectionLabel>
            <h2 id="list-title" className="sr-only">
              {a.listTitle}
            </h2>
            <div className="mt-14 grid gap-x-8 gap-y-20 md:grid-cols-12">
              {list.map((activity, i) => (
                <ExperienceCard key={activity.slug} activity={activity} locale={locale} index={i} cta={a.viewExperience} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Honest introductory state while the catalogue is being prepared */}
      <section aria-labelledby="themes-title" className="on-light section-y bg-stone text-ink">
        <div className="container-x grid gap-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <SectionLabel className="text-bark">{a.emptyLabel}</SectionLabel>
            <TextReveal as="h2" className="text-display-md mt-8">
              {list.length ? a.themesTitle : a.emptyTitle}
            </TextReveal>
            {list.length === 0 && <p className="text-lead mt-6 text-bark">{a.emptyBody}</p>}
            <ButtonLink href={localePath(locale, routes.contact)} className="mt-10">
              {a.emptyCta}
            </ButtonLink>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <h3 id="themes-title" className="text-eyebrow mb-6 font-sans text-bark">
              {a.themesTitle}
            </h3>
            <ol className="border-t border-ink/15">
              {t.home.showcase.items.map((item, i) => (
                <li key={item.title} className="grid grid-cols-[3rem_1fr] gap-4 border-b border-ink/15 py-7">
                  <span className="text-eyebrow pt-2 tabular-nums text-bark">{pad(i + 1)}</span>
                  <div>
                    <p className="text-display-sm">{item.title}</p>
                    <p className="mt-2 text-bark">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <CTASection locale={locale} t={t.home.cta} image="gorgeAutumn" />
    </>
  );
}
