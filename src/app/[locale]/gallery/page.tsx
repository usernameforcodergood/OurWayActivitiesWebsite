import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { galleryKeys } from "@/content/media";
import { PageHero } from "@/components/ui/PageHero";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";

export async function generateMetadata({ params }: PageProps<"/[locale]/gallery">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.gallery, ...t.meta.pages.gallery });
}

export default async function GalleryPage({ params }: PageProps<"/[locale]/gallery">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);

  return (
    <>
      <PageHero locale={locale} eyebrow={t.gallery.hero.eyebrow} title={t.gallery.hero.title} lead={t.gallery.hero.lead} />
      <section aria-label={t.gallery.hero.title} className="bg-ink pb-[var(--section-y)] pt-16 text-bone md:pt-24">
        <div className="container-x">
          <GalleryGrid items={galleryKeys} locale={locale} t={t.gallery} />
          <p className="mt-10 text-sm text-fog">{t.gallery.notice}</p>
        </div>
      </section>
    </>
  );
}
