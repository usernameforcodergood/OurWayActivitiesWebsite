"use client";

import { useEffect, useRef, useState } from "react";
import type { SeriesPoint } from "../../_lib/analytics-queries";
import { A } from "../../_lib/analytics-strings";
import { cn } from "@/lib/utils";
import { bucketLabel, fmtInt } from "./format";

type Metric = "pageviews" | "visitors" | "sessions";
const METRICS: Metric[] = ["sessions", "visitors", "pageviews"];
const H = 260;
const PAD = { top: 16, right: 16, bottom: 30, left: 44 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Interactive line chart of traffic over time with an optional previous-period line. */
export function TrafficChart({ points, prev, bucket }: { points: SeriesPoint[]; prev: SeriesPoint[] | null; bucket: "hour" | "day" }) {
  const [metric, setMetric] = useState<Metric>("sessions");
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const cur = points.map((p) => p[metric]);
  const old = prev ? prev.slice(0, n).map((p) => p[metric]) : [];
  const max = niceMax(Math.max(1, ...cur, ...old));
  const iw = width - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = n > 1 ? `${line(cur)}L${x(n - 1)},${PAD.top + ih}L${x(0)},${PAD.top + ih}Z` : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 72))));
  const total = cur.reduce((a, b) => a + b, 0);
  const prevTotal = old.reduce((a, b) => a + b, 0);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * iw;
    setHover(Math.min(n - 1, Math.max(0, Math.round(n <= 1 ? 0 : (px / iw) * (n - 1)))));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={A.trafficTitle} className="flex flex-wrap gap-1 rounded-lg bg-stone p-1 ring-1 ring-ink/10">
          {METRICS.map((m) => (
            <button
              key={m}
              type="button"

              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-semibold transition",
                metric === m ? "bg-white text-ink shadow-sm ring-1 ring-ink/10" : "text-bark hover:text-ink",
              )}
            >
              {A.metrics[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-bark">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-5 rounded bg-deep-teal" /> {A.current}: <strong className="text-ink">{fmtInt(total)}</strong>
          </span>
          {prev && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-0 w-5 border-t-2 border-dashed border-fog" /> {A.previous}: <strong className="text-ink">{fmtInt(prevTotal)}</strong>
            </span>
          )}
        </div>
      </div>

      <div ref={box} className="relative mt-4">
        <svg width={width} height={H} role="img" aria-label={`${A.trafficTitle}: ${A.metrics[metric]}`} className="block max-w-full">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-ink/10" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-bark text-[11px]">
                {fmtInt(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={p.bucket} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-bark text-[11px]">
                {bucketLabel(p.bucket, bucket)}
              </text>
            ) : null,
          )}
          {area && <path d={area} className="fill-turquoise/10" />}
          {old.length > 1 && <path d={line(old)} fill="none" className="stroke-fog" strokeWidth={2} strokeDasharray="5 4" />}
          {n > 1 && <path d={line(cur)} fill="none" className="stroke-deep-teal" strokeWidth={2.25} strokeLinejoin="round" />}
          {n === 1 && <circle cx={x(0)} cy={y(cur[0])} r={4} className="fill-deep-teal" />}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} className="stroke-ink/25" />
              {old[hover] !== undefined && <circle cx={x(hover)} cy={y(old[hover])} r={3.5} className="fill-white stroke-fog" strokeWidth={2} />}
              <circle cx={x(hover)} cy={y(cur[hover])} r={4} className="fill-white stroke-deep-teal" strokeWidth={2.25} />
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && points[hover] && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg bg-ink px-3 py-2 text-xs text-bone shadow-lg"
            style={{ left: Math.min(Math.max(0, x(hover) - 80), width - 170) }}
          >
            <p className="font-semibold">{bucketLabel(points[hover].bucket, bucket, true)}</p>
            <p className="mt-1">
              {A.metrics[metric]}: <strong>{fmtInt(cur[hover])}</strong>
            </p>
            {prev?.[hover] && (
              <p className="text-fog">
                {A.previous} ({bucketLabel(prev[hover].bucket, bucket)}): {fmtInt(old[hover])}
              </p>
            )}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-bark hover:text-ink">Προβολή ως πίνακας</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-bark">
              <tr>
                <th className="py-1 pr-3 font-semibold">{bucket === "hour" ? "Ώρα" : "Ημέρα"}</th>
                <th className="py-1 pr-3 font-semibold">{A.metrics.sessions}</th>
                <th className="py-1 pr-3 font-semibold">{A.metrics.visitors}</th>
                <th className="py-1 font-semibold">{A.metrics.pageviews}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.bucket} className="border-t border-ink/5">
                  <td className="py-1 pr-3">{bucketLabel(p.bucket, bucket, true)}</td>
                  <td className="py-1 pr-3 tabular-nums">{fmtInt(p.sessions)}</td>
                  <td className="py-1 pr-3 tabular-nums">{fmtInt(p.visitors)}</td>
                  <td className="py-1 tabular-nums">{fmtInt(p.pageviews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
