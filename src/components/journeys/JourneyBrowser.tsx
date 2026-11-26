"use client";

import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import { PRIMARY_CATEGORIES, type PrimaryCategory, type PublicJourney } from "@/lib/cms/types";
import { cn } from "@/lib/utils";
import { JourneyCard } from "./JourneyCard";

type Props = {
  items: PublicJourney[];
  locale: Locale;
  t: Dictionary["journeys"];
  categories: Dictionary["activities"]["filters"]["categories"];
};

/**
 * Archive list with category and year filters and a date order switch.
 * Only filters that have something to choose from are shown.
 */
export function JourneyBrowser({ items, locale, t, categories }: Props) {
  const [category, setCategory] = useState<PrimaryCategory | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [newest, setNewest] = useState(true);
  const f = t.filters;

  const availableCategories = PRIMARY_CATEGORIES.filter((c) => items.some((j) => j.category === c));
  const years = useMemo(() => [...new Set(items.map((j) => j.year))].sort((a, b) => b - a), [items]);

  const visible = items
    .filter((j) => !category || j.category === category)
    .filter((j) => !year || j.year === year)
    .sort((a, b) => (newest ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));

  const chip = (active: boolean) =>
    cn(
      "min-h-11 rounded-full px-5 text-sm font-semibold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquoise",
      active ? "bg-turquoise text-ink ring-turquoise" : "text-bone/85 ring-bone/25 hover:bg-bone/10 hover:text-bone",
    );
  const select =
    "min-h-11 rounded-full bg-bone/5 px-4 text-sm text-bone ring-1 ring-bone/25 focus:outline-none focus:ring-2 focus:ring-turquoise [&>option]:text-ink";

  return (
    <>
      <div className="mt-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {availableCategories.length > 1 ? (
          <div role="group" aria-label={f.category} className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chip(category === null)}>
              {f.allCategories}
            </button>
            {availableCategories.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)} className={chip(category === c)}>
                {categories[c]}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap gap-3">
          {years.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-fog">
              <span className="sr-only">{f.year}</span>
              <select value={year ?? ""} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)} className={select}>
                <option value="">{f.allYears}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}
          {items.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-fog">
              <span className="sr-only">{f.sort}</span>
              <select value={newest ? "newest" : "oldest"} onChange={(e) => setNewest(e.target.value === "newest")} className={select}>
                <option value="newest">{f.newest}</option>
                <option value="oldest">{f.oldest}</option>
              </select>
            </label>
          )}
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-fog">
        {visible.length === 1 ? f.resultsOne : format(f.results, { count: visible.length })}
      </p>

      {visible.length > 0 ? (
        <div className="mt-10 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((j) => (
            <JourneyCard key={j.slug} journey={j} locale={locale} t={t} />
          ))}
        </div>
      ) : (
        <div className="mt-10 border-t border-bone/15 pt-10">
          <p className="text-lead text-bone/85">{f.none}</p>
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setYear(null);
            }}
            className={cn(chip(false), "mt-6")}
          >
            {f.reset}
          </button>
        </div>
      )}
    </>
  );
}
