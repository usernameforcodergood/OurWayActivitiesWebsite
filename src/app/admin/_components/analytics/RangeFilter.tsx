"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { RANGE_PRESETS, type RangePreset } from "../../_lib/analytics-range";
import { A } from "../../_lib/analytics-strings";
import { btnClass } from "../ui";

/** Period picker. Every change updates the URL, so the server recomputes all sections. */
export function RangeFilter({ preset, fromDate, toDate, compare, today }: { preset: RangePreset; fromDate: string; toDate: string; compare: boolean; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<RangePreset>(preset);
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);

  const go = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete("ppage"); // a new period starts at the first page of tables
    start(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" aria-busy={pending}>
      <label className="flex flex-col gap-1 text-xs font-semibold text-bark">
        {A.rangeLabel}
        <select
          className="admin-input min-w-56 text-sm"
          value={choice}
          onChange={(e) => {
            const v = e.target.value as RangePreset;
            setChoice(v);
            if (v !== "custom") go({ range: v, from: null, to: null });
          }}
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>
              {A.ranges[p]}
            </option>
          ))}
        </select>
      </label>
      {choice === "custom" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) go({ range: "custom", from, to });
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-bark">
            {A.from}
            <input type="date" className="admin-input text-sm" value={from} max={today} onChange={(e) => setFrom(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-bark">
            {A.to}
            <input type="date" className="admin-input text-sm" value={to} max={today} onChange={(e) => setTo(e.target.value)} required />
          </label>
          <button type="submit" className={btnClass("primary")}>
            {A.apply}
          </button>
        </form>
      )}
      <label className="flex min-h-10 items-center gap-2 text-sm text-ink">
        <input type="checkbox" className="size-4 accent-deep-teal" checked={compare} onChange={(e) => go({ compare: e.target.checked ? null : "0" })} />
        {A.compare}
      </label>
      {pending && <span className="text-xs text-bark">{A.loading}</span>}
    </div>
  );
}
