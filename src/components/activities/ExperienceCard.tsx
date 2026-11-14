import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { PublicExcursion } from "@/lib/cms/types";
import { localePath, routes } from "@/i18n/routes";
import { ImageReveal } from "@/components/animations/ImageReveal";

/** Editorial experience entry — alternates image width by position. */
export function ExperienceCard({
  excursion,
  locale,
  index,
  cta,
  layout = "alternate",
}: {
  excursion: PublicExcursion;
  locale: Locale;
  index: number;
  cta: string;
  /** "alternate": wide/half rhythm (listing page); "column": equal columns (home). */
  layout?: "alternate" | "column";
}) {
  const wide = layout === "alternate" && index % 3 === 0;
  const meta = [excursion.destination, excursion.duration].filter(Boolean).join(" · ");
  return (
    <article className={layout === "column" ? "" : wide ? "md:col-span-12" : "md:col-span-6"}>
      <Link href={localePath(locale, `${routes.activities}/${excursion.slug}`)} className="group block">
        {excursion.cover ? (
          <ImageReveal
            image={excursion.cover}
            locale={locale}
            decorative
            sizes={wide ? "100vw" : "(min-width: 768px) 50vw, 100vw"}
            className={wide ? "aspect-[4/3] md:aspect-[21/9]" : "aspect-[4/3]"}
            imgClassName="transition-transform duration-[1.4s] ease-out-expo group-hover:scale-[1.05]"
          />
        ) : (
          <div className={`flex items-center justify-center bg-moss ${wide ? "aspect-[4/3] md:aspect-[21/9]" : "aspect-[4/3]"}`}>
            <ImageOff aria-hidden className="size-8 text-fog/50" />
          </div>
        )}
        <div className={layout === "column" ? "mt-6" : "mt-6 grid gap-3 md:grid-cols-12"}>
          <div className={layout === "column" ? "" : "md:col-span-6"}>
            {meta && <p className="text-eyebrow mb-3 text-lichen">{meta}</p>}
            <h3 className="text-display-sm">{excursion.title}</h3>
          </div>
          <p className={layout === "column" ? "mt-3 text-fog" : "text-fog md:col-span-5 md:col-start-8"}>{excursion.summary}</p>
        </div>
        <span className="text-eyebrow mt-5 inline-flex items-center gap-3 text-lichen">
          <span aria-hidden className="h-px w-8 bg-current transition-[width] duration-500 group-hover:w-14" />
          {cta}
        </span>
      </Link>
    </article>
  );
}
