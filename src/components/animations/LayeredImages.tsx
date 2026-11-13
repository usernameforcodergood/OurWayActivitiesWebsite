"use client";

import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { media, type MediaKey } from "@/content/media";
import type { Locale } from "@/i18n/config";

type Props = {
  locale: Locale;
  primary: MediaKey;
  secondary: MediaKey;
  tertiary: MediaKey;
  children: ReactNode;
};

/**
 * Asymmetric composition: three overlapping photographs moving at different
 * scroll speeds (depth), with the copy sitting across the layout's gap.
 */
export function LayeredImages({ locale, primary, secondary, tertiary, children }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        const st = { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true };
        gsap.fromTo(q("[data-depth='1']"), { yPercent: 6 }, { yPercent: -6, ease: "none", scrollTrigger: st });
        gsap.fromTo(q("[data-depth='2']"), { yPercent: 30 }, { yPercent: -30, ease: "none", scrollTrigger: st });
        gsap.fromTo(q("[data-depth='3']"), { yPercent: 55 }, { yPercent: -20, ease: "none", scrollTrigger: st });
        q("[data-layer]").forEach((el, i) => {
          gsap.fromTo(
            el,
            { clipPath: "inset(100% 0% 0% 0%)" },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              duration: 1.5,
              ease: "expo.inOut",
              delay: i * 0.12,
              scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none none" },
            },
          );
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const img = (key: MediaKey, sizes: string) => (
    <Image src={media[key].src} alt={media[key].alt[locale]} fill sizes={sizes} className="object-cover" />
  );

  return (
    <div ref={root} className="relative grid gap-10 md:grid-cols-12 md:gap-8">
      <div className="relative md:col-span-5 md:row-start-1 md:pt-24">{children}</div>

      <div className="relative md:col-span-7 md:col-start-6 md:row-start-1">
        <div data-depth="1" className="relative ml-auto w-[88%] md:w-[82%]">
          <div data-layer className="relative aspect-[4/5] overflow-hidden bg-moss">
            {img(primary, "(min-width: 768px) 45vw, 90vw")}
          </div>
        </div>
        <div data-depth="2" className="absolute -left-2 top-[46%] w-[46%] md:-left-[18%] md:top-[52%] md:w-[44%]">
          <div data-layer className="relative aspect-square overflow-hidden border-[6px] border-stone bg-moss md:border-8">
            {img(secondary, "(min-width: 768px) 25vw, 45vw")}
          </div>
        </div>
      </div>

      <div data-depth="3" className="relative hidden md:col-span-3 md:col-start-2 md:row-start-2 md:-mt-10 md:block">
        <div data-layer className="relative aspect-[3/4] overflow-hidden bg-moss">
          {img(tertiary, "20vw")}
        </div>
      </div>
    </div>
  );
}
