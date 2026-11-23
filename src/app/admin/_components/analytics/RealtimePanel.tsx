"use client";

import { useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { Realtime } from "../../_lib/analytics-queries";
import { A } from "../../_lib/analytics-strings";
import { countryName, fmtInt } from "./format";

const POLL_MS = 30_000;
const time = (iso: string, seconds = false) =>
  new Intl.DateTimeFormat("el-GR", { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), timeZone: "Europe/Athens" }).format(new Date(iso));

/** Live panel: polls the admin-only realtime endpoint. Shows aggregates only, never visitor ids. */
export function RealtimePanel({ initial, at }: { initial: Realtime | null; at: string }) {
  const [data, setData] = useState<Realtime | null>(initial);
  // Starts at the server's fetch time so server and browser render the same text.
  const [updated, setUpdated] = useState<string>(at);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/admin/analytics/realtime", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Realtime;
        if (!stop) {
          setData(json);
          setUpdated(new Date().toISOString());
          setFailed(false);
        }
      } catch {
        if (!stop) setFailed(true);
      }
    };
    const id = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  if (!data) return <p className="text-sm text-bark">{A.errorBody}</p>;

  // Last 30 minutes, one bar per minute (missing minutes are zero).
  const counts = new Map(data.per_minute.map((p) => [new Date(p.minute).toISOString().slice(0, 16), p.n]));
  const now = Date.parse(updated);
  const bars = Array.from({ length: 30 }, (_, i) => {
    const t = new Date(now - (29 - i) * 60_000).toISOString().slice(0, 16);
    return { t, n: counts.get(t) ?? 0 };
  });
  const maxBar = Math.max(1, ...bars.map((b) => b.n));
  const DeviceIcon = (d: string) => (d === "mobile" ? Smartphone : d === "tablet" ? Tablet : Monitor);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-bark">{A.activeNow}</p>
        <p className="mt-1 flex items-center gap-3 text-5xl font-semibold tabular-nums" aria-live="polite">
          <span className="relative flex size-3">
            {data.active_visitors > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-60" />}
            <span className={`relative inline-flex size-3 rounded-full ${data.active_visitors > 0 ? "bg-mint" : "bg-fog"}`} />
          </span>
          {fmtInt(data.active_visitors)}
        </p>
        <p className="mt-1 text-xs text-bark">
          {A.updatedAt}: {time(updated, true)}
          {failed && <span className="ml-2 text-red-800">{A.realtimeError}</span>}
        </p>

        <p className="mt-6 text-xs font-semibold text-bark">{A.perMinute}</p>
        <div className="mt-2 flex h-16 items-end gap-[3px]" role="img" aria-label={A.perMinute}>
          {bars.map((b) => (
            <span
              key={b.t}
              title={`${time(`${b.t}:00Z`)} — ${b.n}`}
              className={b.n ? "flex-1 rounded-t-sm bg-turquoise" : "flex-1 rounded-t-sm bg-ink/10"}
              style={{ height: `${Math.max(6, (b.n / maxBar) * 100)}%` }}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-bark">{A.currentPages}</p>
            {data.pages.length ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {data.pages.map((p) => (
                  <li key={p.path} className="flex justify-between gap-3">
                    <span className="truncate" title={p.path}>
                      {p.title || p.path}
                    </span>
                    <span className="tabular-nums font-semibold">{p.n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-bark">{A.nobodyNow}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-bark">{A.activeExcursions}</p>
            {data.excursions.length ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {data.excursions.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span className="truncate">{e.title}</span>
                    <span className="tabular-nums font-semibold">{e.n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-bark">—</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-bark">{A.recentActivity}</p>
        {data.recent.length ? (
          <ol className="mt-2 max-h-96 divide-y divide-ink/5 overflow-auto text-sm">
            {data.recent.map((r, i) => {
              const Icon = DeviceIcon(r.device);
              return (
                <li key={`${r.at}-${i}`} className="flex items-start gap-3 py-2">
                  <span className="w-24 shrink-0 whitespace-nowrap tabular-nums text-xs text-bark">{time(r.at, true)}</span>
                  <Icon aria-label={A.devices[r.device] ?? r.device} className="mt-0.5 size-4 shrink-0 text-bark" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{A.events[r.name] ?? r.name}</span>
                    <span className="block truncate text-xs text-bark">
                      {r.excursion ? `${r.excursion} · ` : ""}
                      {r.path}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-bark">{countryName(r.country) ?? ""}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-bark">{A.noRecent}</p>
        )}
      </div>
    </div>
  );
}
