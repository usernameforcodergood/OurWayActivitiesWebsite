"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getLenis } from "./SmoothScroll";
import { Wordmark } from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/Button";
import { useExperienceChoice } from "./ExperienceChoice";
import { cn, pad } from "@/lib/utils";

type NavKey = "home" | "activities" | "tailorMade" | "gallery" | "contact";
/**
 * Main navigation, in order — the same on desktop and in the mobile menu.
 * Philosophy and News are not listed here; their pages stay (footer links).
 */
const NAV_ITEMS: NavKey[] = ["home", "activities", "tailorMade", "gallery", "contact"];

/** The menu's own wording for Tailor-Made; the footer keeps `nav.tailorMade`. */
const navLabel = (t: Dictionary["nav"], key: NavKey) => (key === "tailorMade" ? t.createOwn : t[key]);

const ease = [0.16, 1, 0.3, 1] as const;

export function Navbar({ locale, t }: { locale: Locale; t: Dictionary["nav"] }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const choice = useExperienceChoice();

  // One passive, rAF-throttled scroll listener: solid background once the
  // hero is left behind, hide while scrolling down, reveal when scrolling up.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      setScrolled(y > 40);
      // Direction-based: smooth-scroll easing produces tiny same-direction deltas,
      // so any downward movement keeps it hidden; any upward movement reveals it.
      if (y < 480 || delta < -0.5) setHidden(false);
      else if (delta > 0.5) setHidden(true);
      lastY = y;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Menu side-effects: lock scroll, Escape to close, focus trap, focus return.
  useEffect(() => {
    if (!open) return;
    const lenis = getLenis();
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    const trigger = menuButton.current;
    const focusables = () =>
      Array.from(dialog.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    requestAnimationFrame(() => focusables()[0]?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      lenis?.start();
      trigger?.focus();
    };
  }, [open]);

  const isActive = (key: NavKey) =>
    key === "home"
      ? pathname === localePath(locale)
      : (pathname?.startsWith(localePath(locale, routes[key])) ?? false);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[transform,background-color,border-color] duration-700 ease-out-expo",
          scrolled && !open ? "border-b border-bone/10 bg-ink/80 backdrop-blur-md" : "border-b border-transparent",
          hidden && !open ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <div className="container-x flex h-[var(--header-h)] items-center justify-between gap-6">
          <Link
            href={localePath(locale)}
            aria-label={t.homeLink}
            className="relative z-10 text-[1.7rem] leading-none text-bone"
          >
            <Wordmark useLogo />
          </Link>

          <nav aria-label={t.primary} className="hidden xl:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((key) => (
                <li key={key}>
                  <Link
                    href={localePath(locale, routes[key])}
                    aria-current={isActive(key) ? "page" : undefined}
                    className="group relative inline-flex min-h-11 items-center whitespace-nowrap px-2.5 text-sm font-medium xl:px-3.5 text-bone/80 transition-colors hover:text-bone aria-[current=page]:text-bone"
                  >
                    {navLabel(t, key)}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-2.5 bottom-2 h-px xl:inset-x-3.5 origin-left bg-turquoise transition-transform duration-500 ease-out-expo",
                        isActive(key) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                      )}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="relative z-10 flex items-center gap-3 sm:gap-5">
            <LanguageSwitcher
              locale={locale}
              groupLabel={t.languageGroup}
              switchLabel={t.switchLanguage}
              className="text-bone"
            />
            <div className="hidden sm:block">
              <Button type="button" aria-haspopup="dialog" onClick={choice.open} className="!min-h-11 !px-5 !py-2.5 !text-sm">
                {t.inquire}
              </Button>
            </div>
            <button
              ref={menuButton}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? t.closeMenu : t.openMenu}
              className="inline-flex size-11 items-center justify-center rounded-full border border-bone/25 text-bone transition-colors hover:border-bone xl:hidden"
            >
              <span aria-hidden className="relative block h-3 w-5">
                <span
                  className={cn(
                    "absolute left-0 top-0 h-px w-full bg-current transition-transform duration-500 ease-out-expo",
                    open && "translate-y-[6px] rotate-45",
                  )}
                />
                <span
                  className={cn(
                    "absolute bottom-0 left-0 h-px w-full bg-current transition-transform duration-500 ease-out-expo",
                    open && "-translate-y-[5px] -rotate-45",
                  )}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={t.menu}
            data-lenis-prevent
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-forest pt-[var(--header-h)] xl:hidden"
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)" }}
            transition={{ duration: 0.8, ease }}
          >
            <nav aria-label={t.primary} className="container-x flex flex-1 flex-col justify-center py-10">
              <ul className="space-y-1">
                {NAV_ITEMS.map((key, i) => (
                  <li key={key} className="overflow-hidden">
                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ duration: 0.8, ease, delay: 0.15 + i * 0.05 }}
                    >
                      <Link
                        href={localePath(locale, routes[key])}
                        onClick={close}
                        aria-current={isActive(key) ? "page" : undefined}
                        className="group flex items-baseline gap-4 py-1.5 font-display text-[clamp(2.4rem,9vw,4rem)] leading-[1.05] text-bone/85 transition-colors hover:text-bone aria-[current=page]:text-turquoise"
                      >
                        <span className="font-sans text-xs tabular-nums text-fog">{pad(i + 1)}</span>
                        {navLabel(t, key)}
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </nav>
            <motion.div
              className="container-x flex flex-wrap items-center justify-between gap-4 border-t border-bone/10 py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.5 } }}
              exit={{ opacity: 0 }}
            >
              <LanguageSwitcher
                locale={locale}
                groupLabel={t.languageGroup}
                switchLabel={t.switchLanguage}
                className="text-bone"
                onNavigate={close}
              />
              <Button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  close();
                  choice.open();
                }}
              >
                {t.inquire}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
