"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, SplitText, useGSAP, MQ } from "@/lib/gsap";
import { cn } from "@/lib/utils";

type TextRevealProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** "lines" rises each line out of a mask; "words" staggers words. */
  by?: "lines" | "words";
  /** Start when scrolled into view (default) or immediately on mount. */
  trigger?: "scroll" | "mount";
  delay?: number;
  stagger?: number;
  id?: string;
};

/**
 * Headline reveal using GSAP SplitText with line masks. Text is rendered as
 * plain HTML first, so it is readable without JavaScript, for crawlers and
 * with reduced motion (the hide class only applies when motion is allowed).
 */
export function TextReveal({
  as: Tag = "h2",
  children,
  className,
  by = "lines",
  trigger = "scroll",
  delay = 0,
  stagger,
  id,
}: TextRevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        let split: SplitText | null = null;
        // Wait for web fonts so line breaks are measured correctly.
        let cancelled = false;
        document.fonts.ready.then(() => {
          if (cancelled) return;
          split = SplitText.create(el, {
            type: by === "lines" ? "lines" : "words",
            mask: by === "lines" ? "lines" : undefined,
            linesClass: "split-line",
            autoSplit: true,
            onSplit(self) {
              const targets = by === "lines" ? self.lines : self.words;
              gsap.set(el, { visibility: "visible" });
              return gsap.from(targets, {
                yPercent: by === "lines" ? 110 : 40,
                opacity: by === "lines" ? 1 : 0,
                duration: by === "lines" ? 1.3 : 1,
                ease: "expo.out",
                stagger: stagger ?? (by === "lines" ? 0.09 : 0.035),
                delay,
                scrollTrigger:
                  trigger === "scroll" ? { trigger: el, start: "top 88%", toggleActions: "play none none none" } : undefined,
              });
            },
          });
        });
        return () => {
          cancelled = true;
          split?.revert();
        };
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [by, trigger, delay] },
  );

  return (
    <Tag ref={ref} id={id} data-anim="hide" className={cn(className)}>
      {children}
    </Tag>
  );
}
