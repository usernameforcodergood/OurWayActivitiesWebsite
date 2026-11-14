"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { media, type MediaKey } from "@/content/media";
import type { Locale } from "@/i18n/config";
import type { CmsImage } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

export type RevealDirection = "up" | "down" | "left" | "right" | "center";

const clipFrom: Record<RevealDirection, string> = {
  up: "inset(100% 0% 0% 0%)",
  down: "inset(0% 0% 100% 0%)",
  left: "inset(0% 100% 0% 0%)",
  right: "inset(0% 0% 0% 100%)",
  center: "inset(18% 18% 18% 18%)",
};

type ImageRevealProps = {
  /** A built-in photo key, or an uploaded CMS image ({ src, alt, ... }). */
  image: MediaKey | CmsImage;
  locale: Locale;
  sizes: string;
  className?: string;
  imgClassName?: string;
  direction?: RevealDirection;
  /** Vertical drift in % of the image while scrolling past (0 = none). */
  parallax?: number;
  priority?: boolean;
  /** Decorative images get an empty alt. */
  decorative?: boolean;
};

/**
 * Image framed by a clip-path mask that opens in a chosen direction while the
 * picture inside settles from a slight zoom. Optional scroll-linked parallax.
 * The frame keeps a fixed aspect via className, so there is no layout shift.
 */
export function ImageReveal({
  image,
  locale,
  sizes,
  className,
  imgClassName,
  direction = "up",
  parallax = 0,
  priority,
  decorative,
}: ImageRevealProps) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const item =
    typeof image === "string"
      ? { src: media[image].src, alt: media[image].alt[locale] }
      : { src: image.src, alt: image.alt };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        gsap
          .timeline({ scrollTrigger: { trigger: frame.current, start: "top 85%", toggleActions: "play none none none" } })
          .fromTo(
            frame.current,
            { clipPath: clipFrom[direction] },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "expo.inOut" },
          )
          .fromTo(inner.current, { scale: 1.28 }, { scale: 1, duration: 2, ease: "expo.out" }, 0.1);

        if (parallax) {
          gsap.fromTo(
            inner.current,
            { yPercent: -parallax },
            {
              yPercent: parallax,
              ease: "none",
              scrollTrigger: { trigger: frame.current, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        }
      });
      return () => mm.revert();
    },
    { scope: frame, dependencies: [direction, parallax] },
  );

  return (
    <div ref={frame} className={cn("relative overflow-hidden bg-moss", className)}>
      <div
        ref={inner}
        className="absolute inset-0 will-change-transform"
        style={parallax ? { top: `-${parallax}%`, bottom: `-${parallax}%` } : undefined}
      >
        <Image
          src={item.src}
          alt={decorative ? "" : item.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imgClassName)}
        />
      </div>
    </div>
  );
}
