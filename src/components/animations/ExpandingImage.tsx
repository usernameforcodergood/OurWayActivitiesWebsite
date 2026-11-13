"use client";

import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { media, type MediaKey } from "@/content/media";
import type { Locale } from "@/i18n/config";
import { pad } from "@/lib/utils";

type Props = {
  image: MediaKey;
  locale: Locale;
  label: string;
  index: number;
  children: ReactNode;
};

/**
 * A framed, rounded photograph that grows to full bleed as it scrolls into
 * the centre of the viewport, while the picture inside zooms out slightly.
 */
export function ExpandingImage({ image, locale, label, index, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const item = media[image];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        gsap
          .timeline({
            scrollTrigger: { trigger: root.current, start: "top bottom", end: "top 15%", scrub: 0.8 },
          })
          .fromTo(
            q("[data-frame]"),
            { clipPath: isMobile ? "inset(6% 5% 6% 5% round 16px)" : "inset(12% 9% 12% 9% round 28px)" },
            { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none" },
          )
          .fromTo(q("[data-img]"), { scale: 1.25 }, { scale: 1.02, ease: "none" }, 0);

        gsap.from(q("[data-copy]"), {
          y: 60,
          opacity: 0,
          duration: 1.4,
          scrollTrigger: { trigger: root.current, start: "top 35%", toggleActions: "play none none none" },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative">
      <div data-frame className="relative h-[92svh] min-h-[34rem] overflow-hidden bg-moss">
        <div data-img className="absolute inset-0 will-change-transform">
          <Image src={item.src} alt={item.alt[locale]} fill sizes="100vw" className="object-cover" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/10" />
        <div data-copy className="container-x absolute inset-x-0 bottom-0 pb-14 md:pb-24">
          <p className="text-eyebrow mb-6 flex items-center gap-3 text-bone/80">
            <span className="tabular-nums">{pad(index)}</span>
            <span aria-hidden className="h-px w-8 bg-current/50" />
            {label}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
