import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { getActiveAnnouncements } from "@/lib/cms/public";
import { PageHero } from "@/components/ui/PageHero";
import { formatNewsDate } from "@/components/news/AnnouncementView";

export async function generateMetadata({ params }: PageProps<"/[locale]/news">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.news, ...t.meta.pages.news });
}

export default async function NewsPage({ params }: PageProps<"/[locale]/news">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const items = await getActiveAnnouncements(locale);

  return (
    <>
      <PageHero locale={locale} eyebrow={t.news.hero.eyebrow} title={t.news.hero.title} lead={t.news.hero.lead} />
      <section aria-label={t.news.hero.title} className="bg-ink pb-[var(--section-y)] pt-16 text-bone md:pt-24">
        <div className="container-x">
          {items.length === 0 ? (
            <p className="text-lead border-t border-bone/15 pt-10 text-fog">{t.news.empty}</p>
          ) : (
            <ul className="border-t border-bone/15">
              {items.map((a) => (
                <li key={a.slug} className="border-b border-bone/15">
                  <Link href={localePath(locale, `${routes.news}/${a.slug}`)} className="group grid gap-6 py-10 md:grid-cols-12 md:items-center md:gap-8">
                    <time dateTime={a.publishAt} className="text-eyebrow text-fog md:col-span-2">
                      {formatNewsDate(a.publishAt, locale)}
                    </time>
                    <div className="md:col-span-6">
                      <h2 className="text-display-sm transition-colors duration-500 group-hover:text-sand">{a.title}</h2>
                      <p className="mt-3 text-fog">{a.summary}</p>
                      <span className="text-eyebrow mt-5 inline-flex items-center gap-3 text-lichen">
                        <span aria-hidden className="h-px w-8 bg-current transition-[width] duration-500 group-hover:w-14" />
                        {t.news.readMore}
                      </span>
                    </div>
                    {a.image && (
                      <div className="relative aspect-[4/3] overflow-hidden bg-moss md:col-span-3 md:col-start-10">
                        <Image
                          src={a.image.src}
                          alt=""
                          fill
                          sizes="(min-width: 768px) 25vw, 100vw"
                          className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-[1.05]"
                        />
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
