"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { media, type MediaKey } from "@/content/media";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { pad } from "@/lib/utils";

/** One photograph per chapter (by position). */
const CHAPTER_IMAGES: MediaKey[] = ["mesaPlain", "streamRocks", "folkDanceCircle", "roadPause"];

type Props = { locale: Locale; t: Dictionary["home"]["pinned"] };

/**
 * Section 5 — "The journey". On desktop the section pins for ~3 viewport
 * heights while four chapters hand over to each other: text slides out and
 * in, each new photograph wipes up over the last, a progress rail fills.
 * On small screens (or with reduced motion) it becomes a natural vertical
 * sequence — no pinning, no scroll hijacking.
 */
export function PinnedStorySection({ locale, t }: Props) {
  const root = useRef<HTMLElement>(null);
  const chapters = t.chapters;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.desktop, () => {
        const q = gsap.utils.selector(root);
        const texts = q("[data-chapter]");
        const images = q("[data-chapter-img]");
        const inners = q("[data-chapter-inner]");
        const counter = q("[data-counter]")[0];

        gsap.set(texts.slice(1), { autoAlpha: 0, yPercent: 30 });
        gsap.set(images.slice(1), { clipPath: "inset(100% 0% 0% 0%)" });
        gsap.set(inners.slice(1), { scale: 1.3 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut", duration: 1 },
          scrollTrigger: {
            trigger: q("[data-pin]")[0],
            start: "top top",
            end: () => `+=${window.innerHeight * (chapters.length - 1) * 0.95}`,
            pin: true,
            scrub: 0.8,
            snap: { snapTo: 1 / (chapters.length - 1), duration: { min: 0.2, max: 0.6 }, ease: "power1.inOut" },
            invalidateOnRefresh: true,
            onUpdate(self) {
              const idx = Math.min(chapters.length - 1, Math.round(self.progress * (chapters.length - 1)));
              if (counter) counter.textContent = pad(idx + 1);
            },
          },
        });

        tl.to(q("[data-progress]"), { scaleY: 1, ease: "none", duration: chapters.length - 1 }, 0);
        for (let i = 1; i < chapters.length; i++) {
          const at = i - 1;
          tl.to(texts[i - 1], { autoAlpha: 0, yPercent: -30 }, at)
            .to(texts[i], { autoAlpha: 1, yPercent: 0 }, at + 0.15)
            .to(images[i], { clipPath: "inset(0% 0% 0% 0%)" }, at)
            .to(inners[i], { scale: 1 }, at)
            .to(inners[i - 1], { scale: 1.12, yPercent: -6 }, at);
        }
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [chapters.length] },
  );

  return (
    <section ref={root} aria-labelledby="journey-title" className="relative bg-forest text-bone">
      <h2 id="journey-title" className="sr-only">
        {t.label}
      </h2>

      {/* Desktop: pinned stage */}
      <div data-pin className="hidden h-[100svh] min-h-[40rem] md:block">
        <div className="container-x grid h-full grid-cols-12 gap-8 pb-12 pt-[calc(var(--header-h)+2.5rem)]">
          <div className="col-span-5 flex flex-col justify-between">
            <SectionLabel index="04" className="text-fog">
              {t.label}
            </SectionLabel>

            <div className="relative h-[52%]">
              {chapters.map((c, i) => (
                <article key={c.kicker} data-chapter className="absolute inset-x-0 bottom-0">
                  <p className="text-eyebrow mb-6 text-lichen">{c.kicker}</p>
                  <h3 className="text-display-md max-w-[13ch]">{c.title}</h3>
                  <p className="text-lead mt-6 max-w-md text-bone/75">{c.body}</p>
                  <span className="sr-only">
                    {pad(i + 1)} / {pad(chapters.length)}
                  </span>
                </article>
              ))}
            </div>

            <div aria-hidden className="flex items-center gap-5 text-sm tabular-nums text-fog">
              <span data-counter className="font-display text-3xl text-bone">
                01
              </span>
              <span>/ {pad(chapters.length)}</span>
            </div>
          </div>

          <div className="relative col-span-6 col-start-7 flex">
            <div aria-hidden className="absolute -left-8 top-0 h-full w-px bg-bone/15">
              <div data-progress className="h-full w-full origin-top scale-y-0 bg-lichen" />
            </div>
            <div className="relative w-full overflow-hidden rounded-sm bg-moss">
              {CHAPTER_IMAGES.map((key, i) => (
                <div key={key} data-chapter-img className="absolute inset-0 overflow-hidden" style={{ zIndex: i }}>
                  <div data-chapter-inner className="absolute inset-0 will-change-transform">
                    <Image
                      src={media[key].src}
                      alt={media[key].alt[locale]}
                      fill
                      sizes="50vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: natural vertical sequence */}
      <div className="container-x section-y md:hidden">
        <SectionLabel index="04" className="text-fog">
          {t.label}
        </SectionLabel>
        <ol className="mt-12 space-y-20">
          {chapters.map((c, i) => (
            <li key={c.kicker}>
              <ImageReveal
                image={CHAPTER_IMAGES[i]}
                locale={locale}
                sizes="100vw"
                direction={i % 2 ? "left" : "right"}
                className="aspect-[4/5]"
              />
              <p className="text-eyebrow mb-4 mt-8 flex items-center gap-3 text-lichen">
                <span className="tabular-nums text-fog">{pad(i + 1)}</span>
                {c.kicker}
              </p>
              <h3 className="text-display-md">{c.title}</h3>
              <p className="text-lead mt-4 text-bone/75">{c.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
