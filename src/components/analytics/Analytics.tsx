"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  CONSENT_EVENT,
  OPEN_CONSENT_EVENT,
  getConsent,
  installTracker,
  isInternalBrowser,
  setConsent,
  track,
  trackPageView,
} from "@/lib/analytics/client";

type Strings = Dictionary["consent"];
const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "false";

function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const consentSnapshot = () => (!enabled || isInternalBrowser() ? "off" : String(getConsent()));

/**
 * Mounted once in the public layout: records page views on every route
 * change (only with consent) and shows the consent banner until the
 * visitor chooses. The banner reopens from the footer's "Cookie settings".
 */
export function Analytics({ t, privacyHref }: { t: Strings; privacyHref: string }) {
  const pathname = usePathname();
  // "off" on the server and for staff browsers; otherwise the stored choice.
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, () => "off");
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    if (!enabled || isInternalBrowser()) return;
    installTracker();
    const onOpen = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (enabled) trackPageView(pathname);
  }, [pathname]);

  const open = consent === "null" || (reopened && consent !== "off");
  if (!open) return null;
  const choice = consent === "true" ? true : consent === "false" ? false : null;
  const decide = (v: boolean) => {
    setConsent(v);
    setReopened(false);
  };
  const button =
    "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ring-1 ring-bone/40 hover:bg-bone hover:text-ink focus-visible:bg-bone focus-visible:text-ink";

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="ow-consent-title"
      aria-describedby="ow-consent-body"
      className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-lg rounded-sm border border-bone/15 bg-ink/95 p-5 text-bone shadow-2xl backdrop-blur sm:left-6 sm:right-auto sm:mx-0 sm:p-6"
    >
      <p id="ow-consent-title" className="font-semibold">
        {t.title}
      </p>
      <p id="ow-consent-body" className="mt-2 text-sm leading-relaxed text-bone/80">
        {t.body}{" "}
        <Link href={privacyHref} className="underline underline-offset-2 hover:text-turquoise">
          {t.privacyLink}
        </Link>
      </p>
      {choice !== null && (
        <p className="mt-3 text-xs text-fog">{choice ? t.currentOn : t.currentOff}</p>
      )}
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={() => decide(false)} className={button}>
          {t.decline}
        </button>
        <button type="button" onClick={() => decide(true)} className={button}>
          {t.accept}
        </button>
      </div>
    </div>
  );
}

/** Footer link that reopens the consent banner (to change or withdraw consent). */
export function ConsentSettingsButton({ label, className }: { label: string; className?: string }) {
  if (!enabled) return null;
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      {label}
    </button>
  );
}

/** Records one excursion_view per page view of an excursion page. */
export function TrackExcursionView({ excursionId }: { excursionId: string }) {
  useEffect(() => {
    // onceKey: at most once per page view (re-renders, Strict Mode, consent given later).
    const fire = () => track("excursion_view", { excursionId, onceKey: `excursion_view:${excursionId}` });
    // Wait a tick so the route-change page_view is recorded first.
    const id = setTimeout(fire, 0);
    window.addEventListener(CONSENT_EVENT, fire);
    return () => {
      clearTimeout(id);
      window.removeEventListener(CONSENT_EVENT, fire);
    };
  }, [excursionId]);
  return null;
}

/** Records form open (scrolled into view) and form start (first input) once per page view. */
export function useBookingFormTracking(excursionId: string, disabled?: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (disabled || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) track("booking_form_open", { excursionId, onceKey: "booking_form_open" });
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    const onStart = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("input, select, textarea")) {
        track("booking_form_start", { excursionId, onceKey: "booking_form_start" });
      }
    };
    el.addEventListener("input", onStart);
    el.addEventListener("change", onStart);
    return () => {
      io.disconnect();
      el.removeEventListener("input", onStart);
      el.removeEventListener("change", onStart);
    };
  }, [excursionId, disabled]);
  return ref;
}
