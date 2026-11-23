import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "../../_components/ui";
import { A } from "../../_lib/analytics-strings";
import { athensDate, resolveRange, type ResolvedRange } from "../../_lib/analytics-range";
import { AnalyticsUnavailable, PAGE_SIZE, getAnalytics, getRealtime, type AnalyticsData, type PageSort, type Realtime } from "../../_lib/analytics-queries";
import { RangeFilter } from "../../_components/analytics/RangeFilter";
import { TrafficChart } from "../../_components/analytics/TrafficChart";
import { RealtimePanel } from "../../_components/analytics/RealtimePanel";
import { BarList, Donut, KpiCard, Notice, Section, Sparkline, TableWrap, td, th } from "../../_components/analytics/Parts";
import { countryName, fmtDec, fmtDuration, fmtInt, fmtPct, ratio, regionName } from "../../_components/analytics/format";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: A.title };

const SORTS: PageSort[] = ["views", "visitors", "engagement", "path"];

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin();
  const sp = (await searchParams) as SP;
  const range = resolveRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) });
  const compare = one(sp.compare) !== "0";
  const sort = (SORTS as string[]).includes(one(sp.psort) ?? "") ? (one(sp.psort) as PageSort) : "views";
  const page = Math.max(1, Math.min(1000, Number.parseInt(one(sp.ppage) ?? "1", 10) || 1));

  let data: AnalyticsData | null = null;
  let realtime: Realtime | null = null;
  const fetchedAt = new Date().toISOString();
  let failure: "missing" | "error" | null = null;
  try {
    [data, realtime] = await Promise.all([getAnalytics(range, { sort, page }), getRealtime().catch(() => null)]);
  } catch (e) {
    failure = e instanceof AnalyticsUnavailable && e.message === "missing" ? "missing" : "error";
  }

  const href = (next: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const s = one(v);
      if (s) p.set(k, s);
    }
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const q = p.toString();
    return `/admin/analytics${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader title={A.title} description={A.description} />

      <div className="admin-card mb-6 space-y-3 p-4 sm:p-5">
        <Suspense fallback={<p className="text-sm text-bark">{A.loading}</p>}>
          <RangeFilter preset={range.preset} fromDate={range.fromDate} toDate={range.toDate} compare={compare} today={athensDate()} />
        </Suspense>
        <PeriodLine range={range} compare={compare} />
      </div>

      {failure === "missing" && (
        <Notice tone="error" title={A.missingTitle}>
          {A.missingBody}
        </Notice>
      )}
      {failure === "error" && (
        <Notice tone="error" title={A.errorTitle}>
          {A.errorBody}
        </Notice>
      )}

      {data && !data.summary.first_session_at && (
        <div className="space-y-6">
          <Notice title={A.noDataTitle}>{A.noDataBody}</Notice>
          <Section id="realtime" title={A.realtimeTitle} hint={A.realtimeHint}>
            <RealtimePanel initial={realtime} at={fetchedAt} />
          </Section>
        </div>
      )}

      {data && data.summary.first_session_at && <Dashboard data={data} realtime={realtime} fetchedAt={fetchedAt} range={range} compare={compare} sort={sort} page={page} href={href} />}
    </>
  );
}

function PeriodLine({ range, compare }: { range: ResolvedRange; compare: boolean }) {
  const f = (iso: string) => new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Athens" }).format(new Date(iso));
  const ft = (iso: string) => new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" }).format(new Date(iso));
  const span = (from: string, to: string) => {
    const end = new Date(Date.parse(to) - 1).toISOString();
    return range.bucket === "hour" ? `${ft(from)} – ${ft(end)}` : `${f(from)} – ${f(end)}`;
  };
  return (
    <p className="text-xs text-bark">
      <strong className="text-ink">{span(range.from, range.to)}</strong>
      {compare && (
        <>
          {" "}
          · {A.comparedTo} {span(range.prevFrom, range.prevTo)}
        </>
      )}{" "}
      · {A.periodNote}
    </p>
  );
}

function Dashboard({
  data,
  realtime,
  fetchedAt,
  range,
  compare,
  sort,
  page,
  href,
}: {
  data: AnalyticsData;
  realtime: Realtime | null;
  fetchedAt: string;
  range: ResolvedRange;
  compare: boolean;
  sort: PageSort;
  page: number;
  href: (next: Record<string, string | null>) => string;
}) {
  const s = data.summary;
  const p = data.prevSummary;
  const K = A.kpis;
  const empty = s.sessions === 0 && s.pageviews === 0;
  const series = (k: "pageviews" | "visitors" | "sessions") => data.series.map((x) => x[k]);

  const f = data.funnel;
  const steps = [f.entered, f.viewed_excursion, f.clicked_or_later, f.opened_form, f.started_form, f.submitted_ok];
  const totalPages = Math.max(1, Math.ceil((data.pages[0]?.total_rows ?? 0) / PAGE_SIZE));
  const channelRows = (data.sources.channels ?? []).map((c) => ({ key: c.channel, label: A.channels[c.channel] ?? c.channel, value: c.sessions }));
  const tech = data.tech;
  const keyLabel = (k: string, map?: Record<string, string>) => (k ? (map?.[k] ?? k) : A.unknown);

  return (
    <div className="space-y-6">
      <Notice>{A.consentNote}</Notice>
      {!empty && s.sessions < 20 && <Notice tone="warn">{A.fewData(s.sessions)}</Notice>}

      {/* KPIs */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={K.pageviews[0]} hint={K.pageviews[1]} value={fmtInt(s.pageviews)} cur={s.pageviews} prev={p.pageviews} compare={compare}>
          <Sparkline values={series("pageviews")} />
        </KpiCard>
        <KpiCard label={K.visitors[0]} hint={K.visitors[1]} value={fmtInt(s.visitors)} cur={s.visitors} prev={p.visitors} compare={compare}>
          <Sparkline values={series("visitors")} />
        </KpiCard>
        <KpiCard label={K.sessions[0]} hint={K.sessions[1]} value={fmtInt(s.sessions)} cur={s.sessions} prev={p.sessions} compare={compare}>
          <Sparkline values={series("sessions")} />
        </KpiCard>
        <KpiCard label={K.new_visitors[0]} hint={K.new_visitors[1]} value={fmtInt(s.new_visitors)} cur={s.new_visitors} prev={p.new_visitors} compare={compare}>
          <NewReturningBar a={s.new_visitors} b={s.returning_visitors} />
        </KpiCard>
        <KpiCard label={K.returning_visitors[0]} hint={K.returning_visitors[1]} value={fmtInt(s.returning_visitors)} cur={s.returning_visitors} prev={p.returning_visitors} compare={compare}>
          <NewReturningBar a={s.new_visitors} b={s.returning_visitors} highlight="b" />
        </KpiCard>
        <KpiCard label={K.avg_session_seconds[0]} hint={K.avg_session_seconds[1]} value={fmtDuration(s.avg_session_seconds)} cur={s.avg_session_seconds} prev={p.avg_session_seconds} compare={compare} />
        <KpiCard label={K.pages_per_session[0]} hint={K.pages_per_session[1]} value={fmtDec(s.pages_per_session)} cur={s.pages_per_session} prev={p.pages_per_session} compare={compare} />
        <KpiCard label={K.bounce_rate[0]} hint={K.bounce_rate[1]} value={fmtPct(s.bounce_rate)} cur={s.bounce_rate} prev={p.bounce_rate} compare={compare} lowerIsBetter />
      </ul>

      <Section id="traffic" title={A.trafficTitle}>
        {empty ? <p className="text-sm text-bark">{A.emptyRange}</p> : <TrafficChart points={data.series} prev={compare ? data.prevSeries : null} bucket={range.bucket} />}
      </Section>

      <Section id="realtime" title={A.realtimeTitle} hint={A.realtimeHint}>
        <RealtimePanel initial={realtime} at={fetchedAt} />
      </Section>

      {/* Funnel */}
      <Section id="funnel" title={A.funnelTitle} hint={A.funnelHint}>
        {f.entered === 0 ? (
          <p className="text-sm text-bark">{A.emptyRange}</p>
        ) : (
          <>
            <ol className="space-y-3">
              {steps.map((n, i) => {
                const fromPrev = i === 0 ? null : ratio(n, steps[i - 1]);
                return (
                  <li key={A.steps[i]}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                      <span className="font-medium">
                        <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-deep-teal text-xs text-bone">{i + 1}</span>
                        {A.steps[i]}
                      </span>
                      <span className="text-xs text-bark">
                        <strong className="text-base text-ink tabular-nums">{fmtInt(n)}</strong>
                        {fromPrev !== null && (
                          <>
                            {" "}
                            · {fmtPct(fromPrev)} {A.ofPrevious} · <span className="text-red-800">{fmtPct(1 - fromPrev)} {A.dropOff}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 rounded-full bg-ink/5">
                      <div className="h-3 rounded-full bg-turquoise" style={{ width: `${Math.max(n ? 1.5 : 0, (n / f.entered) * 100)}%` }} />
                    </div>
                    {i === 2 && <p className="mt-1 text-xs text-bark">{A.step3Note(f.clicked_button)}</p>}
                  </li>
                );
              })}
            </ol>
            <dl className="mt-6 grid gap-4 border-t border-ink/10 pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-bark">{A.overallConversion}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{fmtPct(ratio(f.submitted_ok, f.entered), 2)}</dd>
              </div>
              <div>
                <dt className="text-xs text-bark">{A.submitAttempts}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{fmtInt(f.submit_attempts)}</dd>
              </div>
              <div>
                <dt className="text-xs text-bark">{A.failures}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{fmtInt(f.had_failure)}</dd>
              </div>
            </dl>
          </>
        )}
      </Section>

      {/* Excursions */}
      <Section id="excursions" title={A.excursionsTitle} hint={A.excursionsHint}>
        {data.excursions.length === 0 ? (
          <p className="text-sm text-bark">{A.emptyRange}</p>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[44rem]">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className={th}>{A.excursionCols.title}</th>
                  <th className={th}>{A.excursionCols.views}</th>
                  <th className={th}>{A.excursionCols.visitors}</th>
                  <th className={th}>{A.excursionCols.clicks}</th>
                  <th className={th}>{A.excursionCols.conversions}</th>
                  <th className={th}>{A.excursionCols.all}</th>
                  <th className={th}>{A.excursionCols.rate}</th>
                </tr>
              </thead>
              <tbody>
                {data.excursions.map((e) => (
                  <tr key={e.excursion_id} className="border-b border-ink/5">
                    <td className={td}>
                      <Link href={`/admin/excursions/${e.excursion_id}`} className="font-medium underline-offset-2 hover:underline">
                        {e.title || e.slug}
                      </Link>
                    </td>
                    <td className={cn(td, "tabular-nums")}>{fmtInt(e.views)}</td>
                    <td className={cn(td, "tabular-nums")}>{fmtInt(e.visitors)}</td>
                    <td className={cn(td, "tabular-nums")}>{fmtInt(e.clickers)}</td>
                    <td className={cn(td, "tabular-nums")}>{fmtInt(e.conversions)}</td>
                    <td className={cn(td, "tabular-nums")}>{fmtInt(e.all_requests)}</td>
                    <td className={cn(td, "tabular-nums font-semibold")}>{fmtPct(ratio(e.conversions, e.visitors))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      {/* Pages */}
      <Section id="pages" title={A.pagesTitle} hint={A.engagementHint}>
        {data.pages.length === 0 ? (
          <p className="text-sm text-bark">{A.emptyRange}</p>
        ) : (
          <>
            <TableWrap>
              <table className="w-full min-w-[40rem]">
                <thead>
                  <tr className="border-b border-ink/10">
                    {(
                      [
                        ["path", A.pageCols.title],
                        ["views", A.pageCols.views],
                        ["visitors", A.pageCols.visitors],
                        ["engagement", A.pageCols.engagement],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key} className={th} aria-sort={sort === key ? (key === "path" ? "ascending" : "descending") : undefined}>
                        <Link href={`${href({ psort: key === "views" ? null : key, ppage: null })}#pages`} scroll={false} className={cn("hover:text-ink", sort === key && "text-ink underline underline-offset-4")}>
                          {label}
                        </Link>
                      </th>
                    ))}
                    <th className={th}>{A.pageCols.share}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.map((r) => (
                    <tr key={r.path} className="border-b border-ink/5">
                      <td className={cn(td, "max-w-[22rem]")}>
                        <span className="block truncate font-medium">{r.title || r.path}</span>
                        <a href={r.path} target="_blank" rel="noopener" className="block truncate text-xs text-bark hover:underline">
                          {r.path}
                        </a>
                      </td>
                      <td className={cn(td, "tabular-nums")}>{fmtInt(r.views)}</td>
                      <td className={cn(td, "tabular-nums")}>{fmtInt(r.visitors)}</td>
                      <td className={cn(td, "tabular-nums")}>{fmtDuration(r.avg_engaged_seconds)}</td>
                      <td className={cn(td, "tabular-nums")}>{fmtPct(r.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {totalPages > 1 && (
              <nav aria-label={A.pagesTitle} className="mt-4 flex items-center justify-between gap-3 text-sm">
                {page > 1 ? (
                  <Link href={`${href({ ppage: page - 1 === 1 ? null : String(page - 1) })}#pages`} scroll={false} className="font-semibold underline-offset-2 hover:underline">
                    ← {A.prev}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-bark">{A.pageOf(page, totalPages)}</span>
                {page < totalPages ? (
                  <Link href={`${href({ ppage: String(page + 1) })}#pages`} scroll={false} className="font-semibold underline-offset-2 hover:underline">
                    {A.next} →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </Section>

      {/* Behaviour */}
      <Section id="behavior" title={A.behaviorTitle}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold">{A.entryTitle}</h3>
            <BarList rows={data.behavior.entry.map((r) => ({ key: r.path, label: r.path, value: r.sessions }))} valueLabel={A.sessionsShort} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">{A.exitTitle}</h3>
            <BarList rows={data.behavior.exit.map((r) => ({ key: r.path, label: r.path, value: r.sessions }))} valueLabel={A.sessionsShort} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">{A.flowsTitle}</h3>
            <BarList
              rows={data.behavior.flows.map((r) => ({
                key: `${r.from_path}→${r.to_path}`,
                label: (
                  <>
                    {r.from_path} <span className="text-bark">→</span> {r.to_path}
                  </>
                ),
                value: r.n,
              }))}
            />
          </div>
        </div>
      </Section>

      {/* Sources */}
      <Section id="sources" title={A.sourcesTitle} hint={A.sourcesHint}>
        <div className="space-y-6">
          <div className="max-w-xl">
            <Donut rows={channelRows} center={fmtInt(s.sessions)} />
          </div>
          {(data.sources.detail ?? []).length === 0 ? (
            <p className="text-sm text-bark">{A.emptyRange}</p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[44rem]">
                <thead>
                  <tr className="border-b border-ink/10">
                    <th className={th}>{A.sourceCols.channel}</th>
                    <th className={th}>{A.sourceCols.source}</th>
                    <th className={th}>{A.sourceCols.medium}</th>
                    <th className={th}>{A.sourceCols.campaign}</th>
                    <th className={th}>{A.sourceCols.visitors}</th>
                    <th className={th}>{A.sourceCols.sessions}</th>
                    <th className={th}>{A.sourceCols.conversions}</th>
                    <th className={th}>{A.sourceCols.rate}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.detail.map((r, i) => (
                    <tr key={i} className="border-b border-ink/5">
                      <td className={td}>{A.channels[r.channel] ?? r.channel}</td>
                      <td className={td}>{r.source || "—"}</td>
                      <td className={td}>{r.medium || "—"}</td>
                      <td className={td}>{r.campaign || "—"}</td>
                      <td className={cn(td, "tabular-nums")}>{fmtInt(r.visitors)}</td>
                      <td className={cn(td, "tabular-nums")}>{fmtInt(r.sessions)}</td>
                      <td className={cn(td, "tabular-nums")}>{fmtInt(r.conversions)}</td>
                      <td className={cn(td, "tabular-nums")}>{fmtPct(ratio(r.conversions, r.sessions))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </Section>

      {/* Devices & geography */}
      <Section id="devices" title={A.devicesTitle} hint={A.geoHint}>
        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <div>
            <h3 className="mb-3 text-sm font-semibold">{A.deviceTitle}</h3>
            <Donut rows={(tech.device ?? []).map((r) => ({ key: r.key, label: keyLabel(r.key, A.devices), value: r.sessions }))} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">{A.browserTitle}</h3>
            <BarList rows={(tech.browser ?? []).map((r) => ({ key: r.key || "?", label: keyLabel(r.key), value: r.sessions }))} valueLabel={A.sessionsShort} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">{A.osTitle}</h3>
            <BarList rows={(tech.os ?? []).map((r) => ({ key: r.key || "?", label: keyLabel(r.key), value: r.sessions }))} valueLabel={A.sessionsShort} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">{A.screenTitle}</h3>
            <BarList rows={(tech.screen ?? []).map((r) => ({ key: r.key || "?", label: keyLabel(r.key, A.screens), value: r.sessions }))} valueLabel={A.sessionsShort} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">{A.countryTitle}</h3>
            <BarList rows={(tech.country ?? []).map((r) => ({ key: r.key || "?", label: countryName(r.key) ?? A.unknown, value: r.sessions }))} valueLabel={A.sessionsShort} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">{A.regionTitle}</h3>
            <BarList
              rows={(tech.region ?? []).map((r) => ({ key: `r:${r.country}:${r.key}`, label: regionName(r.country, r.key), sub: countryName(r.country), value: r.sessions }))}
              valueLabel={A.sessionsShort}
            />
            {(tech.city ?? []).length > 0 && (
              <>
                <h3 className="mb-3 mt-6 text-sm font-semibold">{A.cityTitle}</h3>
                <BarList rows={(tech.city ?? []).map((r) => ({ key: `c:${r.country}:${r.key}`, label: r.key, sub: countryName(r.country), value: r.sessions }))} valueLabel={A.sessionsShort} />
              </>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

function NewReturningBar({ a, b, highlight = "a" }: { a: number; b: number; highlight?: "a" | "b" }) {
  const total = a + b;
  if (!total) return null;
  return (
    <div className="mt-2" aria-label={`${A.newVsReturning}: ${fmtPct(a / total)} / ${fmtPct(b / total)}`}>
      <div className="flex h-2 overflow-hidden rounded-full bg-ink/5">
        <div className={highlight === "a" ? "bg-deep-teal" : "bg-deep-teal/30"} style={{ width: `${(a / total) * 100}%` }} />
        <div className={highlight === "b" ? "bg-turquoise" : "bg-turquoise/30"} style={{ width: `${(b / total) * 100}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-bark">
        {A.newVsReturning}: {fmtPct(a / total, 0)} / {fmtPct(b / total, 0)}
      </p>
    </div>
  );
}
