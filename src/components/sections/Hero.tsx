"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, SplitText, useGSAP, MQ } from "@/lib/gsap";
import { media } from "@/content/media";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { ButtonLink } from "@/components/ui/Button";

type Props = { locale: Locale; t: Dictionary["home"]["hero"] };

/**
 * Cinematic opening: the photograph settles from a slow zoom while the
 * headline rises line by line out of masks. Scrolling away drifts the image
 * (parallax), dims it and lifts the copy, handing over to the next section.
 */
export function Hero({ locale, t }: Props) {
  const root = useRef<HTMLElement>(null);
  const image = media.heroWalker;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const q = gsap.utils.selector(root);
        const title = q("[data-hero-title]")[0];
        let split: SplitText | null = null;

        const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
        intro
          .fromTo(q("[data-hero-media]"), { scale: 1.18 }, { scale: 1, duration: 2.6, ease: "power3.out" }, 0)
          .fromTo(q("[data-hero-shade]"), { opacity: 1 }, { opacity: 0, duration: 1.6, ease: "power2.out" }, 0);

        document.fonts.ready.then(() => {
          if (!title) return;
          split = SplitText.create(title, { type: "lines", mask: "lines", linesClass: "split-line" });
          gsap.set(q("[data-anim=hide]"), { visibility: "visible" });
          intro
            .from(split.lines, { yPercent: 115, duration: 1.5, stagger: 0.12 }, 0.35)
            .from(q("[data-hero-fade]"), { y: 28, opacity: 0, duration: 1.2, stagger: 0.1 }, 0.85)
            .from(q("[data-hero-cue]"), { opacity: 0, duration: 1 }, 1.4);
        });

        // Scroll-out choreography (scrubbed to the scrollbar).
        const out = gsap.timeline({
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
        out
          .to(q("[data-hero-parallax]"), { yPercent: 18, ease: "none" }, 0)
          .to(q("[data-hero-content]"), { yPercent: -28, opacity: 0, ease: "none" }, 0)
          .to(q("[data-hero-dim]"), { opacity: 0.75, ease: "none" }, 0);

        return () => split?.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative h-[100svh] min-h-[38rem] overflow-hidden bg-ink" aria-labelledby="hero-title">
      <div data-hero-parallax className="absolute inset-0 will-change-transform">
        <div data-hero-media className="grain absolute inset-0">
          <Image
            src={image.src}
            alt={image.alt[locale]}
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            className="object-cover object-[50%_40%]"
          />
        </div>
      </div>
      {/* Legibility gradients */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/10 to-ink/85" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink/55 to-transparent md:via-transparent" />
      <div aria-hidden data-hero-dim className="absolute inset-0 bg-ink opacity-0" />
      <div aria-hidden data-hero-shade className="absolute inset-0 bg-ink opacity-0 [.js-motion_&]:opacity-100" />

      <div
        data-hero-content
        className="container-x relative flex h-full flex-col justify-end pb-[max(4.5rem,11svh)] pt-[var(--header-h)] md:pb-[max(7rem,15svh)]"
      >
        <p data-hero-fade data-anim="hide" className="text-eyebrow mb-6 text-bone/80">
          {t.eyebrow}
        </p>
        <h1 id="hero-title" data-hero-title data-anim="hide" className="text-[clamp(2.75rem,min(8.4vw,13svh),9.5rem)] leading-[0.95] tracking-[-0.03em] text-bone">
          {t.titleLines.map((line, i) => (
            <span key={i} className={i === 1 ? "block italic text-sand" : "block"}>
              {line}
            </span>
          ))}
        </h1>
        <div className="mt-8 grid gap-8 md:mt-10 md:grid-cols-12 md:items-end">
          <p data-hero-fade data-anim="hide" className="text-lead max-w-xl text-bone/85 md:col-span-6">
            {t.lead}
          </p>
          <div data-hero-fade data-anim="hide" className="flex flex-wrap gap-3 md:col-span-6 md:justify-end">
            <ButtonLink href={localePath(locale, routes.contact)}>{t.ctaPrimary}</ButtonLink>
            <ButtonLink href="#philosophy" variant="outline" icon={false}>
              {t.ctaSecondary}
            </ButtonLink>
          </div>
        </div>
      </div>

      <a
        href="#philosophy"
        data-hero-cue
        data-anim="hide"
        className="absolute bottom-7 left-[var(--gutter)] hidden min-h-11 items-center gap-4 text-bone/70 transition-colors hover:text-bone md:flex"
      >
        <span aria-hidden className="relative block h-10 w-px overflow-hidden bg-bone/20">
          <span className="absolute inset-0 bg-bone [animation:scroll-cue_2.2s_var(--ease-in-out-quart)_infinite]" />
        </span>
        <span className="text-eyebrow">{t.scroll}</span>
      </a>
    </section>
  );
}
