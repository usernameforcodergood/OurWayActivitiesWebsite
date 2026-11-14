import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { PublicAnnouncement } from "@/lib/cms/types";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { formatNewsDate } from "@/components/news/AnnouncementView";

/** Active announcements strip for the homepage. Renders nothing when empty. */
export function LatestNews({ items, locale, t }: { items: PublicAnnouncement[]; locale: Locale; t: Dictionary }) {
  if (!items.length) return null;
  const n = t.home.news;
  return (
    <section aria-labelledby="news-title" className="on-light bg-stone py-20 text-ink md:py-28">
      <div className="container-x grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <SectionLabel className="text-bark">{n.label}</SectionLabel>
          <h2 id="news-title" className="text-display-md mt-6">
            {n.title}
          </h2>
          <Link href={localePath(locale, routes.news)} className="group mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
            {n.all}
            <ArrowUpRight aria-hidden className="size-4 transition-transform duration-500 group-hover:rotate-45" />
          </Link>
        </div>
        <ul className="border-t border-ink/15 md:col-span-7 md:col-start-6">
          {items.map((a) => (
            <li key={a.slug} className="border-b border-ink/15">
              <Link href={localePath(locale, `${routes.news}/${a.slug}`)} className="group block py-7">
                <time dateTime={a.publishAt} className="text-eyebrow text-bark">
                  {formatNewsDate(a.publishAt, locale)}
                </time>
                <p className="text-display-sm mt-3 transition-colors duration-500 group-hover:text-clay">{a.title}</p>
                <p className="mt-2 text-bark">{a.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
