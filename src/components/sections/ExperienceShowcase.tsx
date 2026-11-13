"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { media, type MediaKey } from "@/content/media";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ButtonLink } from "@/components/ui/Button";
import { TextReveal } from "@/components/animations/TextReveal";
import { pad } from "@/lib/utils";

/** Mood images paired with each experience theme (by position). */
const THEME_IMAGES: MediaKey[] = ["gorgeRiver", "folkDanceCircle", "goatsCoast", "villageSteps"];

type Props = { locale: Locale; t: Dictionary["home"]["showcase"] };

/**
 * Section 4 — experience themes as an editorial index. On pointer devices a
 * photograph follows the cursor over the hovered row; on touch devices each
 * row carries its own thumbnail instead (no hover-only content).
 */
export function ExperienceShowcase({ locale, t }: Props) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 180, damping: 22, mass: 0.6 });

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        q("[data-row]").forEach((row) => {
          const line = row.querySelector("[data-line]");
          const content = row.querySelectorAll("[data-row-content]");
          const tl = gsap.timeline({ scrollTrigger: { trigger: row, start: "top 88%", toggleActions: "play none none none" } });
          tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "expo.inOut" }).from(
            content,
            { y: 40, opacity: 0, duration: 1.1, stagger: 0.08 },
            0.25,
          );
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  };

  return (
    <section ref={root} aria-labelledby="showcase-title" className="section-y relative bg-ink text-bone">
      <div className="container-x">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <SectionLabel index="03" className="text-fog">
              {t.label}
            </SectionLabel>
            <TextReveal as="h2" id="showcase-title" className="text-display-lg mt-8">
              {t.title}
            </TextReveal>
          </div>
          <p className="text-lead text-fog md:col-span-4 md:col-start-9">{t.intro}</p>
        </div>

        <ul
          className="relative mt-16 md:mt-24"
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
        >
          {t.items.map((item, i) => (
            <li
              key={item.title}
              data-row
              className="relative"
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
            >
              <span data-line aria-hidden className="absolute inset-x-0 top-0 h-px origin-left bg-bone/15" />
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3 py-8 md:grid-cols-12 md:gap-8 md:py-11">
                <span data-row-content className="text-eyebrow tabular-nums text-fog md:col-span-1">
                  {pad(i + 1)}
                </span>
                <h3
                  data-row-content
                  className={`font-display text-display-md transition-[color,translate] duration-700 ease-out-expo md:col-span-6 ${
                    active === i ? "md:translate-x-4 md:text-sand" : ""
                  } ${active !== null && active !== i ? "md:text-bone/35" : ""}`}
                >
                  {item.title}
                </h3>
                <p data-row-content className="col-span-2 max-w-md text-fog md:col-span-4 md:col-start-9">
                  {item.body}
                </p>
                {/* Touch / small screens: inline thumbnail */}
                <div className="relative col-span-2 aspect-[16/9] overflow-hidden md:hidden">
                  <Image
                    src={media[THEME_IMAGES[i]].src}
                    alt={media[THEME_IMAGES[i]].alt[locale]}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </li>
          ))}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-bone/15" />

          {/* Pointer-following preview (desktop only, decorative) */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 hidden md:block"
            style={{ x: sx, y: sy }}
          >
            <AnimatePresence>
              {active !== null && (
                <motion.div
                  key="preview"
                  className="relative -translate-x-1/2 -translate-y-1/2 overflow-hidden"
                  style={{ width: "clamp(14rem, 22vw, 22rem)", aspectRatio: "4 / 5" }}
                  initial={{ opacity: 0, scale: 0.7, clipPath: "inset(50% 50% 50% 50%)" }}
                  animate={{ opacity: 1, scale: 1, clipPath: "inset(0% 0% 0% 0%)" }}
                  exit={{ opacity: 0, scale: 0.8, clipPath: "inset(50% 50% 50% 50%)" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  {THEME_IMAGES.map((key, i) => (
                    <motion.div
                      key={key}
                      className="absolute inset-0"
                      initial={false}
                      animate={{ opacity: active === i ? 1 : 0, scale: active === i ? 1 : 1.12 }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Image src={media[key].src} alt="" fill sizes="22vw" className="object-cover" />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </ul>

        <div className="mt-16 flex flex-col gap-8 md:mt-20 md:flex-row md:items-center md:justify-between">
          <p className="text-lead max-w-xl text-bone/85">{t.note}</p>
          <div className="flex flex-wrap items-center gap-6">
            <ButtonLink href={localePath(locale, routes.contact)}>{t.cta}</ButtonLink>
            <Link
              href={localePath(locale, routes.activities)}
              className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lichen"
            >
              {t.allLink}
              <ArrowUpRight aria-hidden className="size-4 transition-transform duration-500 group-hover:rotate-45" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
