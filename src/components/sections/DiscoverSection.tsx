import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import type { MediaKey } from "@/content/media";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { TextReveal } from "@/components/animations/TextReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { cn } from "@/lib/utils";

type TileKey = "activities" | "destinations" | "gallery";

const TILES: Array<{ key: TileKey; image: MediaKey; frame: string; wrap: string; parallax: number }> = [
  {
    key: "activities",
    image: "bridgeVillage",
    frame: "aspect-[4/5] md:aspect-[5/6]",
    wrap: "md:col-span-6 md:row-span-2",
    parallax: 8,
  },
  {
    key: "destinations",
    image: "valleyVillage",
    frame: "aspect-[4/3]",
    wrap: "md:col-span-5 md:col-start-8 md:mt-24",
    parallax: 10,
  },
  {
    key: "gallery",
    image: "gorgeAutumn",
    frame: "aspect-[16/10]",
    wrap: "md:col-span-4 md:col-start-8",
    parallax: 12,
  },
];

/** Section 6 — an asymmetric collage of entry points, not a card grid. */
export function DiscoverSection({ locale, t }: { locale: Locale; t: Dictionary["home"]["discover"] }) {
  return (
    <section aria-labelledby="discover-title" className="on-light section-y bg-limestone text-ink">
      <div className="container-x">
        <SectionLabel index="05" className="text-bark">
          {t.label}
        </SectionLabel>
        <TextReveal as="h2" id="discover-title" className="text-display-lg mt-8 max-w-[14ch]">
          {t.title}
        </TextReveal>

        <ul className="mt-16 grid gap-14 md:mt-24 md:grid-cols-12 md:gap-x-8 md:gap-y-16">
          {TILES.map((tile, i) => (
            <li key={tile.key} className={tile.wrap}>
              <Link href={localePath(locale, routes[tile.key])} className="group block">
                <div className="relative">
                  <ImageReveal
                    image={tile.image}
                    locale={locale}
                    decorative
                    sizes={i === 0 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 40vw, 100vw"}
                    direction={i === 0 ? "up" : i === 1 ? "right" : "left"}
                    parallax={tile.parallax}
                    className={cn(tile.frame)}
                    imgClassName="transition-transform duration-[1.4s] ease-out-expo group-hover:scale-[1.06]"
                  />
                  <span
                    aria-hidden
                    className="absolute right-4 top-4 inline-flex size-12 items-center justify-center rounded-full bg-limestone text-ink transition-transform duration-700 ease-out-expo group-hover:rotate-45"
                  >
                    <ArrowUpRight className="size-5" strokeWidth={1.5} />
                  </span>
                </div>
                <div className="mt-6 flex items-baseline justify-between gap-6 border-b border-ink/15 pb-5">
                  <h3 className="text-display-sm transition-colors duration-500 group-hover:text-clay">
                    {t.tiles[tile.key].title}
                  </h3>
                  <p className="max-w-[16rem] text-right text-sm text-bark">{t.tiles[tile.key].body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
