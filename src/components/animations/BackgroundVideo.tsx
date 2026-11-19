"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { cn } from "@/lib/utils";

export type BackgroundVideoSource = {
  /** Full-size encode (desktop / tablet). */
  src: string;
  /** Lighter encode for phones (max-width 767px). */
  mobileSrc?: string;
  /** First frame of the clip: shown until playback starts, and instead of the video for reduced motion. */
  poster: string;
};

type Props = BackgroundVideoSource & { className?: string; priority?: boolean };

/**
 * Ambient background film in the home hero's visual language: film grain,
 * ink legibility gradients and the same slow zoom-settle on arrival.
 *
 * Loading: the film is only fetched once the area is (nearly) on screen and
 * after the page itself has loaded; the poster sits underneath, so there is
 * never a blank flash, and the video fades in only once frames are playing.
 * Playback pauses off-screen. Reduced motion, Save-Data or a refused
 * autoplay (e.g. iOS low-power mode) all leave the static poster.
 */
export function BackgroundVideo({ src, mobileSrc, poster, className, priority }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        gsap.fromTo("[data-bg-media]", { scale: 1.12 }, { scale: 1, duration: 2.6, ease: "power3.out" });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia(MQ.reduced);
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduced.matches || saveData) return;

    let requested = false;
    let visible = false;
    const request = () => {
      if (requested || !visible) return;
      requested = true;
      // Chosen once, so resizing never re-downloads the film.
      setSource(mobileSrc && window.matchMedia("(max-width: 767px)").matches ? mobileSrc : src);
    };
    // Let the page (excursion images, fonts) finish loading before the film competes for bandwidth.
    // A slow third-party image must not hold the film back indefinitely, hence the cap.
    let loaded = document.readyState === "complete";
    const whenLoaded = () => {
      loaded = true;
      request();
    };
    if (!loaded) window.addEventListener("load", whenLoaded, { once: true });
    const cap = window.setTimeout(whenLoaded, 3000);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        const v = video.current;
        if (!visible) return v?.pause();
        if (loaded) request();
        if (requested && v && !reduced.matches) v.play().catch(() => {});
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);

    const onReducedChange = () => {
      if (!reduced.matches) return;
      video.current?.pause();
      setPlaying(false);
    };
    reduced.addEventListener("change", onReducedChange);
    return () => {
      io.disconnect();
      window.clearTimeout(cap);
      window.removeEventListener("load", whenLoaded);
      reduced.removeEventListener("change", onReducedChange);
    };
  }, [src, mobileSrc]);

  useEffect(() => {
    const v = video.current;
    if (!source || !v) return;
    v.muted = true; // set as a property too: required for autoplay on iOS
    v.play().catch(() => {}); // refused: the poster stays
  }, [source]);

  return (
    <div ref={root} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div data-bg-media className="grain absolute inset-0 will-change-transform">
        <Image src={poster} alt="" fill priority={priority} sizes="100vw" className="object-cover" />
        <video
          ref={video}
          src={source ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-[1.6s] ease-out",
            playing ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      {/* Legibility: an even ink veil plus the home hero's gradients; the bottom
          melts fully into ink so the section below continues seamlessly. */}
      <div className="absolute inset-0 bg-ink/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/10 to-ink" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/60 via-transparent to-ink/50" />
    </div>
  );
}
