"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { media, type MediaKey } from "@/content/media";
import type { Locale } from "@/i18n/config";

/** Full-bleed background photograph drifting slower than the page. */
export function ParallaxBackground({ image, locale }: { image: MediaKey; locale: Locale }) {
  const ref = useRef<HTMLDivElement>(null);
  const item = media[image];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        gsap.fromTo(
          ref.current,
          { yPercent: -12, scale: 1.08 },
          {
            yPercent: 12,
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: ref.current?.parentElement, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="grain absolute -inset-y-[12%] inset-x-0 will-change-transform">
      <Image src={item.src} alt={item.alt[locale]} fill sizes="100vw" className="object-cover" />
    </div>
  );
}
