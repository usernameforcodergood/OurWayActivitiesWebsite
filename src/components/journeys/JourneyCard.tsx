import Link from "next/link";
import { CheckCircle2, ImageOff, MapPin } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { PublicJourney } from "@/lib/cms/types";
import { formatDayRange } from "@/lib/bookings/format";
import { ImageReveal } from "@/components/animations/ImageReveal";

/** One past trip: cover photo, "Completed" badge, title, place, date. */
export function JourneyCard({ journey, locale, t }: { journey: PublicJourney; locale: Locale; t: Dictionary["journeys"] }) {
  return (
    <article>
      <Link href={localePath(locale, `${routes.journeys}/${journey.slug}`)} className="group block">
        <div className="relative">
          {journey.cover ? (
            <ImageReveal
              image={journey.cover}
              locale={locale}
              decorative
              sizes="(min-width: 768px) 33vw, 100vw"
              className="aspect-[4/5]"
              imgClassName="transition-transform duration-[1.4s] ease-out-expo group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-moss">
              <ImageOff aria-hidden className="size-8 text-fog/50" />
            </div>
          )}
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-semibold text-bone backdrop-blur-sm">
            <CheckCircle2 aria-hidden className="size-3.5 text-turquoise" />
            {t.completed}
          </span>
        </div>
        <div className="mt-6">
          <p className="text-eyebrow text-mint">
            <time dateTime={journey.date}>{formatDayRange(journey.date, journey.dateUntil, locale)}</time>
          </p>
          <h3 className="text-display-sm mt-3">{journey.title}</h3>
          {journey.location && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-fog">
              <MapPin aria-hidden className="size-4 shrink-0" />
              <span>
                <span className="sr-only">{t.location}: </span>
                {journey.location}
              </span>
            </p>
          )}
        </div>
        <span className="text-eyebrow mt-5 inline-flex items-center gap-3 text-turquoise">
          <span aria-hidden className="h-px w-8 bg-current transition-[width] duration-500 group-hover:w-14" />
          {t.view}
        </span>
      </Link>
    </article>
  );
}
