"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { PRIMARY_CATEGORIES, type PrimaryCategory, type PublicExcursion } from "@/lib/cms/types";
import { cn } from "@/lib/utils";
import { ExperienceCard } from "./ExperienceCard";

type Filters = Dictionary["activities"]["filters"];

/** Lowercase, accent-free text so "Ζαγόρι" matches "ζαγορι" and "zagori". */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function haystack(e: PublicExcursion): string {
  return normalize([e.title, e.summary, e.destination, e.category, e.duration, e.slug.replace(/-/g, " ")].filter(Boolean).join(" "));
}

/**
 * Experiences list with the three primary categories and a search box.
 * All published experiences show by default; category and search combine.
 */
export function ExperienceBrowser({
  items,
  locale,
  t,
  cta,
}: {
  items: PublicExcursion[];
  locale: Locale;
  t: Filters;
  cta: string;
}) {
  const [category, setCategory] = useState<PrimaryCategory | null>(null);
  const [query, setQuery] = useState("");

  const indexed = useMemo(() => items.map((e) => ({ e, text: haystack(e) })), [items]);
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const visible = indexed
    .filter(({ e }) => !category || e.primaryCategory === category)
    .filter(({ text }) => words.every((w) => text.includes(w)))
    .map(({ e }) => e);

  // Only offer categories that have at least one experience.
  const available = PRIMARY_CATEGORIES.filter((c) => items.some((e) => e.primaryCategory === c));

  const chip = (active: boolean) =>
    cn(
      "min-h-11 rounded-full px-5 text-sm font-semibold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sand",
      active ? "bg-sand text-ink ring-sand" : "text-bone/85 ring-bone/25 hover:bg-bone/10 hover:text-bone",
    );

  return (
    <>
      <div className="mt-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {available.length > 0 && (
          <div role="group" aria-label={t.label} className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chip(category === null)}>
              {t.all}
            </button>
            {available.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)} className={chip(category === c)}>
                {t.categories[c]}
              </button>
            ))}
          </div>
        )}
        <div className="relative w-full lg:max-w-sm">
          <label htmlFor="experience-search" className="sr-only">
            {t.search}
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fog" />
          <input
            id="experience-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            maxLength={100}
            autoComplete="off"
            className="min-h-11 w-full rounded-full bg-bone/5 py-2 pl-11 pr-4 text-bone ring-1 ring-bone/25 placeholder:text-fog focus:outline-none focus:ring-2 focus:ring-sand"
          />
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-fog">
        {visible.length === 1 ? t.resultsOne : t.results.replace("{count}", String(visible.length))}
      </p>

      {visible.length > 0 ? (
        <div className="mt-10 grid gap-x-8 gap-y-20 md:grid-cols-12">
          {visible.map((excursion, i) => (
            <ExperienceCard key={excursion.slug} excursion={excursion} locale={locale} index={i} cta={cta} />
          ))}
        </div>
      ) : (
        <div className="mt-10 border-t border-bone/15 pt-10">
          <p className="text-lead text-bone/85">{t.noResults}</p>
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setQuery("");
            }}
            className={cn(chip(false), "mt-6")}
          >
            {t.reset}
          </button>
        </div>
      )}
    </>
  );
}
