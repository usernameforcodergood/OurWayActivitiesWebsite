import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { TextReveal } from "@/components/animations/TextReveal";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { ExpandingImage } from "@/components/animations/ExpandingImage";
import { LayeredImages } from "@/components/animations/LayeredImages";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { pad } from "@/lib/utils";

type Block = Dictionary["home"]["story"]["blocks"][number];

function BlockText({ block, index, className }: { block: Block; index: number; className?: string }) {
  return (
    <div className={className}>
      <p className="text-eyebrow mb-6 flex items-center gap-3 text-bark">
        <span className="tabular-nums">{pad(index + 1)}</span>
        <span aria-hidden className="h-px w-8 bg-current/40" />
        {block.kicker}
      </p>
      <TextReveal as="h3" className="text-display-md text-ink">
        {block.title}
      </TextReveal>
      <p className="text-lead mt-6 max-w-lg text-bark">{block.body}</p>
    </div>
  );
}

/**
 * Section 3 — four compositions that deliberately differ:
 * image-left / text-left / full-bleed overlay / layered asymmetric.
 */
export function StorySection({ locale, t }: { locale: Locale; t: Dictionary["home"]["story"] }) {
  const [nature, culture, people, place] = t.blocks;

  return (
    <section aria-labelledby="story-title" className="on-light relative bg-stone text-ink">
      <div className="container-x section-y pb-0">
        <SectionLabel index="02" className="text-bark">
          {t.label}
        </SectionLabel>
        <TextReveal as="h2" id="story-title" className="text-display-lg mt-8 max-w-[16ch]">
          {t.title}
        </TextReveal>
      </div>

      {/* A — image left, text right */}
      <div className="container-x grid items-center gap-10 pt-20 md:grid-cols-12 md:gap-8 md:pt-32">
        <ImageReveal
          image="ridgeAutumn"
          locale={locale}
          sizes="(min-width: 768px) 55vw, 100vw"
          direction="left"
          parallax={10}
          className="aspect-[4/5] md:col-span-7 md:aspect-[5/6]"
        />
        <BlockText block={nature} index={0} className="md:col-span-4 md:col-start-9" />
      </div>

      {/* B — text left, image right, with an offset detail image */}
      <div className="container-x grid items-center gap-10 pt-28 md:grid-cols-12 md:gap-8 md:pt-48">
        <BlockText block={culture} index={1} className="order-2 md:order-1 md:col-span-4 md:col-start-1" />
        <div className="relative order-1 md:order-2 md:col-span-7 md:col-start-6">
          <ImageReveal
            image="folkDanceMen"
            locale={locale}
            sizes="(min-width: 768px) 55vw, 100vw"
            direction="right"
            parallax={8}
            className="aspect-[5/4]"
          />
          <ImageReveal
            image="folkDanceWomen"
            locale={locale}
            sizes="(min-width: 768px) 20vw, 40vw"
            direction="up"
            className="absolute -bottom-10 -left-4 aspect-[3/4] w-[38%] border-[6px] border-stone md:-bottom-16 md:-left-20 md:w-[34%] md:border-8"
          />
        </div>
      </div>

      {/* C — full-bleed image that opens up to the edges, overlay text */}
      <div className="pt-32 md:pt-56">
        <ExpandingImage image="shepherd" locale={locale} label={people.kicker} index={3}>
          <TextReveal as="h3" className="text-display-lg max-w-[18ch] text-bone">
            {people.title}
          </TextReveal>
          <p className="text-lead mt-6 max-w-xl text-bone/85">{people.body}</p>
        </ExpandingImage>
      </div>

      {/* D — layered, overlapping, asymmetric */}
      <div className="container-x section-y">
        <LayeredImages locale={locale} primary="stoneHouse" secondary="hillChapel" tertiary="villageSteps">
          <BlockText block={place} index={3} />
        </LayeredImages>
      </div>
    </section>
  );
}
