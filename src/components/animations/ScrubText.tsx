"use client";

import { useRef, type ElementType } from "react";
import { gsap, SplitText, useGSAP, MQ } from "@/lib/gsap";

type ScrubTextProps = {
  as?: ElementType;
  text: string;
  className?: string;
};

/**
 * Large statement whose words "light up" as the reader scrolls through it —
 * the reading pace is tied to the scroll position.
 */
export function ScrubText({ as: Tag = "p", text, className }: ScrubTextProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const split = SplitText.create(el, { type: "words", autoSplit: false });
        gsap.fromTo(
          split.words,
          { opacity: 0.16 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.1,
            scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: 0.6 },
          },
        );
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className}>
      {text}
    </Tag>
  );
}
