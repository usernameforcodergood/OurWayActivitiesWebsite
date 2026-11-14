import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { PublicAnnouncement } from "@/lib/cms/types";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";

export function formatNewsDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(new Date(iso));
}

/** Announcement article — shared by the public page and the admin preview. */
export function AnnouncementView({ item, locale, t }: { item: PublicAnnouncement; locale: Locale; t: Dictionary }) {
  return (
    <article className="bg-ink pb-[var(--section-y)] pt-[calc(var(--header-h)+clamp(3rem,8vw,6rem))] text-bone">
      <div className="container-x max-w-4xl">
        <Link href={localePath(locale, routes.news)} className="text-eyebrow mb-10 inline-flex min-h-11 items-center gap-2 text-fog hover:text-bone">
          <ArrowLeft aria-hidden className="size-4" />
          {t.news.back}
        </Link>
        <SectionLabel className="text-fog">
          <time dateTime={item.publishAt}>{formatNewsDate(item.publishAt, locale)}</time>
        </SectionLabel>
        <h1 className="text-display-lg mt-8">{item.title}</h1>
        <p className="text-lead mt-8 text-bone/85">{item.summary}</p>
        {item.expiresAt && (
          <p className="mt-4 text-sm text-fog">{format(t.news.validUntil, { date: formatNewsDate(item.expiresAt, locale) })}</p>
        )}
      </div>
      {item.image && (
        <div className="container-x mt-14 max-w-5xl">
          <ImageReveal image={item.image} locale={locale} priority sizes="(min-width: 1024px) 64rem, 100vw" className="aspect-[16/9]" />
        </div>
      )}
      {item.body.length > 0 && (
        <div className="container-x mt-14 max-w-3xl space-y-6 text-lg leading-relaxed text-bone/85">
          {item.body.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
