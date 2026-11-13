import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Activity } from "@/content/types";
import { localePath, routes } from "@/i18n/routes";
import { ImageReveal } from "@/components/animations/ImageReveal";

/** Editorial experience entry — alternates image width by position. */
export function ExperienceCard({
  activity,
  locale,
  index,
  cta,
}: {
  activity: Activity;
  locale: Locale;
  index: number;
  cta: string;
}) {
  const wide = index % 3 === 0;
  return (
    <article className={wide ? "md:col-span-12" : "md:col-span-6"}>
      <Link href={localePath(locale, `${routes.activities}/${activity.slug}`)} className="group block">
        <ImageReveal
          image={activity.image}
          locale={locale}
          decorative
          sizes={wide ? "100vw" : "(min-width: 768px) 50vw, 100vw"}
          className={wide ? "aspect-[4/3] md:aspect-[21/9]" : "aspect-[4/3]"}
          imgClassName="transition-transform duration-[1.4s] ease-out-expo group-hover:scale-[1.05]"
        />
        <div className="mt-6 grid gap-3 md:grid-cols-12">
          <h3 className="text-display-sm md:col-span-6">{activity.title[locale]}</h3>
          <p className="text-fog md:col-span-5 md:col-start-8">{activity.summary[locale]}</p>
        </div>
        <span className="text-eyebrow mt-5 inline-flex items-center gap-3 text-lichen">
          <span aria-hidden className="h-px w-8 bg-current transition-[width] duration-500 group-hover:w-14" />
          {cta}
        </span>
      </Link>
    </article>
  );
}
