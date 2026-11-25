"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

let lenisInstance: Lenis | null = null;
let firstPathname: string | null = null;
let navigated = false;

/**
 * True once the visitor has moved to another page inside the app (not on the
 * first page load). Set in a layout effect that runs before the new page's own
 * layout effects, so a page can read it while setting up its intro.
 */
export function isClientNavigation(): boolean {
  return navigated;
}

/** Access the active Lenis instance (null when reduced motion is on). */
export function getLenis(): Lenis | null {
  return lenisInstance;
}

/** Scroll to a target using Lenis when active, native smooth scroll otherwise. */
export function scrollToTarget(target: string | HTMLElement | number) {
  if (lenisInstance) {
    lenisInstance.scrollTo(target, { offset: 0, duration: 1.4 });
    return;
  }
  const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (typeof el === "number") window.scrollTo({ top: el });
  else el?.scrollIntoView({ behavior: "auto", block: "start" });
}

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in
 * perfect sync. Native scrolling is preserved on touch devices (Lenis only
 * smooths wheel input) and Lenis is disabled entirely for reduced motion.
 */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, anchors: true });
    lenisInstance = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);

  // New page: start at the top *before* it is painted (a passive effect let
  // Safari show the new page at the old scroll position for a frame or two),
  // then re-measure all triggers. Links with a #hash are left to the router.
  useLayoutEffect(() => {
    if (firstPathname === null) firstPathname = pathname;
    else if (pathname !== firstPathname) navigated = true;
    if (!window.location.hash) {
      window.scrollTo(0, 0);
      lenisInstance?.scrollTo(0, { immediate: true, force: true });
    }
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
