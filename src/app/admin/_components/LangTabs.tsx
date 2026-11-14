"use client";

import { CheckCircle2, CircleDashed } from "lucide-react";
import { t } from "../_lib/strings";
import { cn } from "@/lib/utils";

export type Lang = "el" | "en";

/** Greek / English switch with a completeness indicator per language. */
export function LangTabs({
  value,
  onChange,
  complete,
}: {
  value: Lang;
  onChange: (l: Lang) => void;
  complete: Record<Lang, boolean>;
}) {
  const tabs: Array<[Lang, string]> = [
    ["el", t.common.greek],
    ["en", t.common.english],
  ];
  return (
    <div role="tablist" aria-label="Language" className="inline-flex rounded-lg bg-stone/70 p-1">
      {tabs.map(([lang, label]) => (
        <button
          key={lang}
          type="button"
          role="tab"
          id={`tab-${lang}`}
          aria-selected={value === lang}
          aria-controls={`panel-${lang}`}
          onClick={() => onChange(lang)}
          className={cn(
            "flex min-h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold transition",
            value === lang ? "bg-white shadow-sm" : "text-bark hover:text-ink",
          )}
        >
          {label}
          {complete[lang] ? (
            <CheckCircle2 aria-label={t.common.complete} className="size-4 text-emerald-600" />
          ) : (
            <CircleDashed aria-label={t.common.incomplete} className="size-4 text-amber-600" />
          )}
        </button>
      ))}
    </div>
  );
}
