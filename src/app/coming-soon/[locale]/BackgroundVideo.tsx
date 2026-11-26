"use client";

import { useEffect, useRef } from "react";

/**
 * Full-bleed background footage for the Coming Soon page. The poster shows
 * immediately (and stays, with a slow CSS drift) when the visitor prefers
 * reduced motion or saves data; otherwise the clip loads and loops muted.
 */
export function BackgroundVideo({ poster, src, mobileSrc }: { poster: string; src: string; mobileSrc: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) return;
    video.src = window.matchMedia("(max-width: 768px)").matches ? mobileSrc : src;
    video.play().catch(() => {
      /* Autoplay blocked: the poster stays. */
    });
  }, [src, mobileSrc]);

  return (
    <video
      ref={ref}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      className="cs-drift absolute inset-0 size-full object-cover"
    />
  );
}
