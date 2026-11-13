import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { SectionLabel } from "@/components/ui/SectionLabel";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.privacy, ...t.meta.pages.privacy });
}

/** Interim privacy notice — must be replaced after legal review. */
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const p = (await getDictionary(locale)).privacy;

  return (
    <article className="bg-ink pb-[var(--section-y)] pt-[calc(var(--header-h)+5rem)] text-bone">
      <div className="container-x max-w-4xl">
        <SectionLabel className="text-fog">{p.eyebrow}</SectionLabel>
        <h1 className="text-display-lg mt-8">{p.title}</h1>
        <p role="note" className="mt-8 border-l-2 border-sand bg-sand/10 p-4 text-sm text-bone/90">
          {p.draftNotice}
        </p>
        <p className="mt-4 text-sm text-fog">{p.updated}</p>
        <div className="mt-14 space-y-12">
          {p.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-display-sm">{s.title}</h2>
              <p className="mt-4 leading-relaxed text-bone/80">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
