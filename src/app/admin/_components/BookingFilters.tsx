"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { t } from "../_lib/strings";

type Option = { value: string; label: string };

/**
 * One search field + one status dropdown, applied as you type / choose.
 * Everything else sits under «Περισσότερα φίλτρα» and is never required.
 * State lives in the URL (shareable, back button works).
 */
export function BookingFilters({
  hidden,
  values,
  statuses,
  excursions,
  sorts,
  withDepartureRange,
  clearHref,
}: {
  /** Kept as-is on every change (section, date window, empty dates). */
  hidden: Record<string, string>;
  values: { q: string; status: string; excursion: string; from: string; to: string; sfrom: string; sto: string; sort: string; payment: string };
  statuses: Option[];
  excursions: Option[];
  sorts: Option[];
  withDepartureRange: boolean;
  clearHref: string | null;
}) {
  const B = t.bookings;
  const P = t.payments;
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // The URL can change without this form (Clear, back button, links): mirror it,
  // except in the field being typed in.
  useEffect(() => {
    const f = form.current;
    if (!f) return;
    for (const [name, value] of Object.entries(values)) {
      const el = f.elements.namedItem(name);
      if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el !== document.activeElement) {
        el.value = value || (el instanceof HTMLSelectElement && el.querySelector('option[value="all"]') ? "all" : "");
      }
    }
  }, [values]);

  const apply = () => {
    if (!form.current) return;
    if (timer.current) clearTimeout(timer.current);
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(form.current)) {
      const s = String(v).trim();
      if (s && s !== "all") sp.set(k, s);
    }
    const qs = sp.toString();
    start(() => router.replace(qs ? `/admin/bookings?${qs}` : "/admin/bookings", { scroll: false }));
  };
  const applySoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(apply, 400);
  };

  const advancedActive = Boolean(values.excursion || values.from || values.to || values.sfrom || values.sto || values.sort || (values.payment && values.payment !== "all"));

  return (
    <form
      ref={form}
      method="get"
      action="/admin/bookings"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="space-y-2"
    >
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bark" />
          <label htmlFor="bq" className="sr-only">
            {t.common.search}
          </label>
          <input id="bq" name="q" type="search" defaultValue={values.q} placeholder={B.searchPlaceholder} onChange={applySoon} className="admin-input pl-9" />
          {pending && <Loader2 aria-hidden className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-bark" />}
        </div>
        <label htmlFor="bstatus" className="sr-only">
          {B.status}
        </label>
        <select id="bstatus" name="status" defaultValue={values.status} onChange={apply} className="admin-input sm:w-56">
          <option value="all">{B.allStatuses}</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <details open={advancedActive} className="group rounded-xl bg-white ring-1 ring-ink/10 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-bark hover:text-ink">
          {B.moreFilters}
          <ChevronDown aria-hidden className="size-4 transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-ink/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="bex" className="mb-1 block text-xs font-semibold text-bark">
              {B.excursion}
            </label>
            <select id="bex" name="excursion" defaultValue={values.excursion} onChange={apply} className="admin-input">
              <option value="">{B.allExcursions}</option>
              {excursions.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          {withDepartureRange && (
            <fieldset>
              <legend className="mb-1 block text-xs font-semibold text-bark">{B.departureRange}</legend>
              <div className="flex gap-2">
                <input type="date" name="from" defaultValue={values.from} onChange={apply} aria-label={`${B.departureRange} ${B.rangeFrom}`} className="admin-input" />
                <input type="date" name="to" defaultValue={values.to} onChange={apply} aria-label={`${B.departureRange} ${B.rangeTo}`} className="admin-input" />
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-1 block text-xs font-semibold text-bark">{B.submittedRange}</legend>
            <div className="flex gap-2">
              <input type="date" name="sfrom" defaultValue={values.sfrom} onChange={apply} aria-label={`${B.submittedRange} ${B.rangeFrom}`} className="admin-input" />
              <input type="date" name="sto" defaultValue={values.sto} onChange={apply} aria-label={`${B.submittedRange} ${B.rangeTo}`} className="admin-input" />
            </div>
          </fieldset>
          <div>
            <label htmlFor="bpay" className="mb-1 block text-xs font-semibold text-bark">
              {P.filterLabel}
            </label>
            <select id="bpay" name="payment" defaultValue={values.payment} onChange={apply} className="admin-input">
              <option value="all">{P.filterAll}</option>
              <option value="open">{P.filterOpen}</option>
              <option value="refund">{P.filterRefund}</option>
            </select>
          </div>
          <div>
            <label htmlFor="bsort" className="mb-1 block text-xs font-semibold text-bark">
              {B.sortLabel}
            </label>
            <select id="bsort" name="sort" defaultValue={values.sort} onChange={apply} className="admin-input">
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {clearHref && (
            <div className="flex items-end">
              <Link href={clearHref} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-bark ring-1 ring-ink/10 hover:bg-stone/60">
                {B.clear}
              </Link>
            </div>
          )}
        </div>
      </details>
    </form>
  );
}
