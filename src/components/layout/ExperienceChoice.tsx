"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { media, type MediaKey } from "@/content/media";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getLenis } from "./SmoothScroll";

/**
 * "Ενδιαφέρομαι" → a choice between the two ways to travel with OurWay:
 *   A. design your own (tailor-made request form)
 *   B. join one of the published experiences (the experiences listing)
 * One dialog for the whole site; any trigger opens it via useExperienceChoice().
 */
type Ctx = { open: () => void };
const ChoiceContext = createContext<Ctx | null>(null);

export function useExperienceChoice(): Ctx {
  const ctx = useContext(ChoiceContext);
  if (!ctx) throw new Error("useExperienceChoice must be used inside <ExperienceChoiceProvider>");
  return ctx;
}

const ease = [0.16, 1, 0.3, 1] as const;

type ChoiceOption = {
  key: "tailor" | "discover";
  href: string;
  image: MediaKey;
  copy: Dictionary["choice"]["tailor"];
  variant: "primary" | "outline";
};

/** The single list of choices. Every "Inquire" / "Start your experience" trigger opens these. */
function choiceOptions(locale: Locale, t: Dictionary["choice"]): ChoiceOption[] {
  return [
    { key: "tailor", href: `${localePath(locale, routes.tailorMade)}#plan`, image: "roadPause", copy: t.tailor, variant: "primary" },
    { key: "discover", href: localePath(locale, routes.activities), image: "valleyVillage", copy: t.discover, variant: "outline" },
  ];
}

type Props = { locale: Locale; t: Dictionary["choice"]; children: ReactNode };

export function ExperienceChoiceProvider({ locale, t, children }: Props) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ChoiceContext.Provider value={value}>
      {children}
      <AnimatePresence>{isOpen && <ChoiceDialog locale={locale} t={t} onClose={close} />}</AnimatePresence>
    </ChoiceContext.Provider>
  );
}

function ChoiceDialog({ locale, t, onClose }: { locale: Locale; t: Dictionary["choice"]; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Lock scroll, Escape to close, focus trap, focus return.
  useEffect(() => {
    const lenis = getLenis();
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(dialog.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
      // Only return focus if it is still somewhere sensible (not after navigating away).
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [onClose]);

  const options = choiceOptions(locale, t);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-stretch justify-center sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.3, ease } }}
      transition={{ duration: reduce ? 0 : 0.4, ease }}
    >
      <button type="button" aria-label={t.close} tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-ink/85 backdrop-blur-sm" />

      <motion.div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="choice-title"
        aria-describedby="choice-lead"
        data-lenis-prevent
        className="relative flex max-h-dvh w-full max-w-6xl flex-col overflow-y-auto overscroll-contain bg-forest text-bone shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        initial={reduce ? false : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0, transition: { duration: 0.3, ease } }}
        transition={{ duration: 0.7, ease }}
      >
        <div className="flex items-start justify-between gap-6 px-5 pb-6 pt-6 sm:px-10 sm:pt-9 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-eyebrow flex items-center gap-3 text-mint">
              <span aria-hidden className="h-px w-8 bg-current/60" />
              {t.eyebrow}
            </p>
            <h2 id="choice-title" className="mt-4 max-w-[24ch] font-display text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.06] tracking-[-0.02em]">
              {t.title}
            </h2>
            <p id="choice-lead" className="mt-3 text-base leading-relaxed text-bone/75 sm:text-lg">
              {t.lead}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            data-autofocus
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-bone/25 text-bone transition-colors hover:border-bone hover:bg-bone hover:text-ink"
          >
            <X aria-hidden className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="relative grid gap-4 px-5 pb-5 sm:px-10 sm:pb-8 md:grid-cols-2 md:gap-5 lg:px-12">
          {options.map((o, i) => (
            <motion.article
              key={o.key}
              aria-labelledby={`choice-${o.key}-title`}
              className={cn(
                "group relative flex flex-col overflow-hidden",
                o.key === "tailor" ? "bg-moss" : "border border-bone/15 bg-ink",
              )}
              initial={reduce ? false : { y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease, delay: 0.15 + i * 0.08 }}
            >
              <div className="relative aspect-[16/7] overflow-hidden lg:aspect-[16/6]">
                <Image
                  src={media[o.image].src}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 560px, 100vw"
                  className="object-cover transition-transform duration-[1.4s] ease-out-expo group-hover:scale-105"
                />
                <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-t", o.key === "tailor" ? "from-moss via-moss/20 to-transparent" : "from-ink via-ink/20 to-transparent")} />
                <span className="absolute left-5 top-5 text-xs tabular-nums text-bone/80 sm:left-7 sm:top-6">{String.fromCharCode(65 + i)}</span>
              </div>
              <div className="relative -mt-8 flex flex-1 flex-col px-5 pb-6 sm:px-7 sm:pb-7">
                <p className={cn("text-eyebrow", o.key === "tailor" ? "text-lichen" : "text-mint")}>{o.copy.tag}</p>
                <h3 id={`choice-${o.key}-title`} className="mt-2 font-display text-[clamp(1.5rem,2.3vw,2.1rem)] leading-[1.1]">
                  {o.copy.title}
                </h3>
                <p className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-bone/80">{o.copy.body}</p>
                <ButtonLink href={o.href} variant={o.variant} onClick={onClose} className="mt-6 self-start">
                  {o.copy.cta}
                </ButtonLink>
              </div>
            </motion.article>
          ))}

          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-bone/20 bg-forest font-display text-sm italic text-bone/80 md:flex"
          >
            {t.or}
          </span>
        </div>

        <p className="border-t border-bone/10 px-5 py-4 text-sm text-fog sm:px-10 lg:px-12">
          {t.contactNote}{" "}
          <Link href={localePath(locale, routes.contact)} onClick={onClose} className="font-semibold text-bone underline decoration-bone/30 underline-offset-4 hover:text-turquoise">
            {t.contactLink}
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}

/** Text-style trigger for server components (e.g. the footer). */
export function ExperienceChoiceLink({ className, children }: { className?: string; children: ReactNode }) {
  const { open } = useExperienceChoice();
  return (
    <button type="button" aria-haspopup="dialog" onClick={open} className={className}>
      {children}
    </button>
  );
}
