"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { media, type MediaKey } from "@/content/media";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getLenis } from "@/components/layout/SmoothScroll";
import { gsap, useGSAP, MQ } from "@/lib/gsap";

type Props = { items: MediaKey[]; locale: Locale; t: Dictionary["gallery"] };

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k]));
const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Editorial masonry (CSS columns, natural aspect ratios) with an accessible
 * lightbox: focus moves into the dialog and back, Esc closes, ←/→ navigate,
 * focus is trapped, page scroll is locked, swipe works on touch.
 */
export function GalleryGrid({ items, locale, t }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const [dir, setDir] = useState(0);
  const grid = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const lastIndex = useRef<number | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        gsap.utils.toArray<HTMLElement>("[data-tile]", grid.current).forEach((el, i) => {
          gsap.fromTo(
            el,
            { clipPath: "inset(100% 0% 0% 0%)", y: 60 },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              y: 0,
              duration: 1.4,
              ease: "expo.out",
              delay: (i % 3) * 0.08,
              scrollTrigger: { trigger: el, start: "top 92%", toggleActions: "play none none none" },
            },
          );
        });
      });
      return () => mm.revert();
    },
    { scope: grid },
  );

  const go = useCallback(
    (delta: number) => {
      setDir(delta);
      setIndex((i) => (i === null ? i : (i + delta + items.length) % items.length));
    },
    [items.length],
  );

  const open = index !== null;

  useEffect(() => {
    if (!open) return;
    const lenis = getLenis();
    const triggerEls = triggers.current;
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        const f = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button") ?? []);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      lenis?.start();
      const i = lastIndex.current;
      if (i !== null) triggerEls[i]?.focus();
    };
  }, [open, go]);

  useEffect(() => {
    if (index !== null) lastIndex.current = index;
  }, [index]);

  const current = index !== null ? media[items[index]] : null;

  return (
    <>
      <ul ref={grid} className="columns-1 gap-4 sm:columns-2 md:gap-6 lg:columns-3">
        {items.map((key, i) => {
          const m = media[key];
          return (
            <li key={key} data-tile className="mb-4 break-inside-avoid md:mb-6">
              <button
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                type="button"
                onClick={() => {
                  setDir(0);
                  setIndex(i);
                }}
                aria-label={fill(t.open, { alt: m.alt[locale] })}
                className="group relative block w-full overflow-hidden bg-moss"
                style={{ aspectRatio: `${m.width} / ${m.height}` }}
              >
                <Image
                  src={m.src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-[1.06] group-focus-visible:scale-[1.06]"
                />
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-ink/80 to-transparent p-4 pt-12 text-left text-sm text-bone opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100"
                >
                  {m.alt[locale]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {open && current && (
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={t.dialogLabel}
            data-lenis-prevent
            className="fixed inset-0 z-[60] flex flex-col bg-ink/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="container-x flex h-[var(--header-h)] shrink-0 items-center justify-between text-bone">
              <p className="text-sm tabular-nums text-fog" aria-live="polite">
                {fill(t.counter, { current: (index ?? 0) + 1, total: items.length })}
              </p>
              <button
                type="button"
                data-autofocus
                onClick={() => setIndex(null)}
                aria-label={t.close}
                className="inline-flex size-11 items-center justify-center rounded-full border border-bone/25 hover:border-bone"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 md:px-24">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.figure
                  key={index}
                  custom={dir}
                  className="relative flex h-full w-full flex-col items-center justify-center"
                  initial={{ opacity: 0, x: dir * 80 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -80 }}
                  transition={{ duration: 0.6, ease }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.25}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -70) go(1);
                    else if (info.offset.x > 70) go(-1);
                  }}
                >
                  <div className="relative min-h-0 w-full flex-1">
                    <Image
                      src={current.src}
                      alt={current.alt[locale]}
                      fill
                      sizes="100vw"
                      className="pointer-events-none select-none object-contain"
                      draggable={false}
                    />
                  </div>
                  <figcaption className="mt-4 max-w-2xl text-center text-sm text-fog">{current.alt[locale]}</figcaption>
                </motion.figure>
              </AnimatePresence>

              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t.prev}
                className="absolute left-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-bone/25 bg-ink/50 text-bone hover:border-bone md:left-6"
              >
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t.next}
                className="absolute right-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-bone/25 bg-ink/50 text-bone hover:border-bone md:right-6"
              >
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
