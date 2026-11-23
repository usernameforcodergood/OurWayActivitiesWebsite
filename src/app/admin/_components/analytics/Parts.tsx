import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { A } from "../../_lib/analytics-strings";
import { change } from "../../_lib/analytics-range";
import { fmtInt, fmtPct } from "./format";

/** Section card with a title and an optional hint line. */
export function Section({ id, title, hint, actions, children, className }: { id?: string; title: string; hint?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("admin-card scroll-mt-20 p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold">
            {title}
          </h2>
          {hint && <p className="mt-1 max-w-3xl text-xs text-bark">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error"; title?: string; children: ReactNode }) {
  const cls = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    error: "border-red-200 bg-red-50 text-red-950",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "note"} className={cn("rounded-xl border p-4 text-sm", cls)}>
      {title && <p className="flex items-center gap-2 font-semibold"><Info aria-hidden className="size-4" /> {title}</p>}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

/** "+12,5%" with an arrow; `lowerIsBetter` flips the colour (e.g. bounce rate). */
export function Delta({ cur, prev, lowerIsBetter, show }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean; show: boolean }) {
  if (!show) return null;
  const c = change(cur, prev);
  if (c === null) return <span className="text-xs text-bark">{A.noPrev}</span>;
  const up = c > 0.0005;
  const down = c < -0.0005;
  const good = lowerIsBetter ? down : up;
  const bad = lowerIsBetter ? up : down;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good && "text-emerald-700", bad && "text-red-700", !good && !bad && "text-bark")}>
      <Icon aria-hidden className="size-3.5" />
      {up ? "+" : ""}
      {fmtPct(c)}
    </span>
  );
}

export function KpiCard({
  label,
  hint,
  value,
  cur,
  prev,
  compare,
  lowerIsBetter,
  children,
}: {
  label: string;
  hint: string;
  value: string;
  cur: number | null;
  prev: number | null;
  compare: boolean;
  lowerIsBetter?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="admin-card flex flex-col p-4">
      <p className="text-sm font-medium text-bark">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      <div className="mt-1 min-h-5">
        <Delta cur={cur} prev={prev} lowerIsBetter={lowerIsBetter} show={compare} />
      </div>
      {children}
      <p className="mt-auto pt-3 text-xs leading-snug text-bark">{hint}</p>
    </li>
  );
}

/** Tiny inline trend line (no axes) for a KPI card. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const max = Math.max(1, ...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i * w) / (values.length - 1)).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className={cn("mt-2 h-7 w-full", className)}>
      <path d={d} fill="none" className="stroke-turquoise" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Horizontal bars for a ranked list. */
export function BarList({ rows, valueLabel, empty }: { rows: { key: string; label: ReactNode; value: number; sub?: ReactNode; href?: string }[]; valueLabel?: string; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-bark">{empty ?? A.emptyRange}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="relative">
          <div aria-hidden className="absolute inset-y-0 left-0 rounded-md bg-turquoise/15" style={{ width: `${(r.value / max) * 100}%` }} />
          <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate">
              {r.href ? (
                <Link href={r.href} className="underline-offset-2 hover:underline">
                  {r.label}
                </Link>
              ) : (
                r.label
              )}
              {r.sub && <span className="ml-2 text-xs text-bark">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums" title={valueLabel}>
              {fmtInt(r.value)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

const PALETTE = ["#104447", "#20afc0", "#3db99f", "#77cebc", "#3e5456", "#a6b8b6", "#c99a3b"];

/** Donut with a legend; values are shares of the total. */
export function Donut({ rows, center }: { rows: { key: string; label: string; value: number }[]; center?: string }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <p className="text-sm text-bark">{A.emptyRange}</p>;
  const r = 42;
  const c = 2 * Math.PI * r;
  const starts = rows.map((_, i) => rows.slice(0, i).reduce((a, x) => a + (x.value / total) * c, 0));
  return (
    // Legend beside the ring only when the card itself is wide enough (container query).
    <div className="@container">
    <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-center">
      <svg viewBox="0 0 120 120" className="size-36 shrink-0 -rotate-90" role="img" aria-label={rows.map((x) => `${x.label}: ${fmtPct(x.value / total)}`).join(", ")}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(11 23 24 / 0.06)" strokeWidth="16" />
        {rows.map((row, i) => {
          const len = (row.value / total) * c;
          return (
            <circle
              key={row.key}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-starts[i]}
            />
          );
        })}
        {center && (
          <text x="60" y="60" dy="0.35em" textAnchor="middle" className="rotate-90 fill-ink text-[15px] font-semibold" style={{ transformOrigin: "60px 60px" }}>
            {center}
          </text>
        )}
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {rows.map((row, i) => (
          <li key={row.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <strong>{fmtPct(row.value / total)}</strong> <span className="text-xs text-bark">({fmtInt(row.value)})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

/** Wrapper that keeps wide tables scrollable on phones. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">{children}</div>;
}

export const th = "whitespace-nowrap py-2 pr-4 text-left text-xs font-semibold text-bark";
export const td = "py-2 pr-4 align-top text-sm";
