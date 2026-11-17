import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { PublicExcursion } from "@/lib/cms/types";
import { formatDateShort } from "@/lib/bookings/format";
import { SectionLabel } from "@/components/ui/SectionLabel";

/** Published events (soonest first). Renders nothing when there are none. */
export function UpcomingEvents({ items, locale, t, today }: { items: PublicExcursion[]; locale: Locale; t: Dictionary; today: string }) {
  if (!items.length) return null;
  const e = t.home.events;
  return (
    <section aria-labelledby="events-title" className="border-t border-bone/10 bg-ink py-20 text-bone md:py-28">
      <div className="container-x grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <SectionLabel className="text-fog">{e.label}</SectionLabel>
          <h2 id="events-title" className="text-display-md mt-6">
            {e.title}
          </h2>
        </div>
        <ul className="border-t border-bone/15 md:col-span-7 md:col-start-6">
          {items.map((ev) => {
            const next = ev.departures.find((d) => d.date >= today && d.status !== "cancelled" && d.status !== "completed");
            return (
              <li key={ev.slug} className="border-b border-bone/15">
                <Link href={localePath(locale, `${routes.activities}/${ev.slug}`)} className="group flex items-start justify-between gap-6 py-7">
                  <span>
                    <span className="text-eyebrow text-lichen">
                      {next ? <time dateTime={next.date}>{formatDateShort(next.date, locale)}</time> : e.datesTbd}
                      {ev.destination && ` · ${ev.destination}`}
                    </span>
                    <span className="text-display-sm mt-3 block transition-colors duration-500 group-hover:text-sand">{ev.title}</span>
                    <span className="mt-2 block text-fog">{ev.summary}</span>
                  </span>
                  <ArrowUpRight aria-label={e.view} className="mt-1 size-5 shrink-0 text-lichen transition-transform duration-500 group-hover:rotate-45" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
