import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, calendarRange, getCalendarData, type CalendarRun, type CalendarView } from "../_lib/calendar";
import { fmt, t } from "../_lib/strings";
import { CalendarQuickAdd } from "./CalendarQuickAdd";
import { Card, formatDay } from "./ui";

const C = t.calendar;

const PHASE_CLS: Record<CalendarRun["phase"], string> = {
  upcoming: "border-emerald-600 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  full: "border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100",
  done: "border-ink/25 bg-stone/70 text-bark hover:bg-stone",
  cancelled: "border-red-400 bg-red-50 text-red-900 line-through hover:bg-red-100",
};
const DOT_CLS: Record<CalendarRun["phase"], string> = {
  upcoming: "bg-emerald-600",
  full: "bg-amber-500",
  done: "bg-ink/30",
  cancelled: "bg-red-400",
};

const runHref = (r: CalendarRun) => `/admin/excursions/${r.excursionId}?departure=${r.id}`;
const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const shortDay = (iso: string) => new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

function Chip({ run, day, compact }: { run: CalendarRun; day: string; compact?: boolean }) {
  const continued = day > run.start;
  return (
    <Link
      href={runHref(run)}
      title={`${run.title} · ${formatDay(run.start, run.time)}${run.end !== run.start ? ` → ${formatDay(run.end)}` : ""} · ${C.phases[run.phase]}`}
      className={cn("block rounded-md border-l-4 px-1.5 py-0.5 text-xs font-medium transition", PHASE_CLS[run.phase], compact ? "truncate text-[11px]" : "break-words")}
    >
      {continued ? "↳ " : run.time ? <span className="tabular-nums">{run.time} </span> : null}
      {run.title}
      <span className="sr-only"> — {C.phases[run.phase]}</span>
    </Link>
  );
}

/** Dashboard calendar: all scheduled runs, month or week view, plus the next runs and quick repeat. */
export async function AdminCalendar({ view, anchor, today, addDate }: { view: CalendarView; anchor: string; today: string; addDate?: string }) {
  const range = calendarRange(view, anchor);
  const { runs, upcoming, templates } = await getCalendarData(range.start, range.end, today);

  const days: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);
  const on = (day: string) => runs.filter((r) => r.start <= day && r.end >= day);
  const inMonth = (day: string) => view === "week" || day.slice(0, 7) === anchor.slice(0, 7);
  const link = (params: { view?: CalendarView; cal?: string; add?: string }) => {
    const q = new URLSearchParams({ view: params.view ?? view, cal: params.cal ?? anchor });
    if (params.add) q.set("add", params.add);
    return `/admin?${q.toString()}#${params.add ? "calendar-add" : "calendar"}`;
  };
  const heading = view === "month" ? monthLabel(range.first ?? anchor) : fmt(C.weekOf, { start: shortDay(range.start), end: shortDay(range.end) });
  const visibleDays = days.filter((d) => inMonth(d) && on(d).length > 0);

  return (
    <section id="calendar" aria-labelledby="calendar-title" className="mb-8 scroll-mt-24">
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="calendar-title" className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays aria-hidden className="size-5 text-lagoon" />
              {C.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label={C.viewLabel} className="inline-flex rounded-lg bg-stone/60 p-0.5 text-sm">
                {(["month", "week"] as const).map((v) => (
                  <Link
                    key={v}
                    href={link({ view: v })}
                    aria-current={view === v ? "page" : undefined}
                    className={cn("rounded-md px-3 py-1.5 font-semibold", view === v ? "bg-white shadow-sm" : "text-bark hover:text-ink")}
                  >
                    {v === "month" ? C.month : C.week}
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-2">
              <Link href={link({ cal: range.prev })} aria-label={C.prev} className="inline-flex size-9 items-center justify-center rounded-lg ring-1 ring-ink/15 hover:bg-stone/60">
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
              <Link href={link({ cal: today })} className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-semibold ring-1 ring-ink/15 hover:bg-stone/60">
                {C.today}
              </Link>
              <Link href={link({ cal: range.next })} aria-label={C.next} className="inline-flex size-9 items-center justify-center rounded-lg ring-1 ring-ink/15 hover:bg-stone/60">
                <ChevronRight aria-hidden className="size-4" />
              </Link>
              </div>
            </div>
          </div>
          <p className="mb-3 text-base font-semibold capitalize" aria-live="polite">
            {heading}
          </p>

          {/* Grid (tablet and up) */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-7 border-b border-ink/10 pb-1 text-center text-xs font-semibold uppercase tracking-wide text-bark">
              {C.days.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <ol className="grid grid-cols-7 gap-px overflow-hidden rounded-b-lg bg-ink/8">
              {days.map((day) => {
                const items = on(day);
                const max = view === "week" ? 12 : 3;
                const isToday = day === today;
                return (
                  <li key={day} className={cn("group relative bg-white p-1.5", view === "week" ? "min-h-48" : "min-h-24", !inMonth(day) && "bg-limestone/60")}>
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                          isToday ? "bg-lagoon font-semibold text-white" : inMonth(day) ? "text-ink" : "text-bark/60",
                        )}
                      >
                        <span className="sr-only">{formatDay(day)}</span>
                        <span aria-hidden>{Number(day.slice(8))}</span>
                      </span>
                      {day > today && (
                        <Link
                          href={link({ add: day })}
                          aria-label={fmt(C.addOn, { date: formatDay(day) })}
                          className="inline-flex size-6 items-center justify-center rounded-md text-bark opacity-0 hover:bg-stone focus:opacity-100 group-hover:opacity-100"
                        >
                          <Plus aria-hidden className="size-3.5" />
                        </Link>
                      )}
                    </div>
                    <ul className="space-y-1">
                      {items.slice(0, max).map((r) => (
                        <li key={r.id}>
                          <Chip run={r} day={day} compact={view === "month"} />
                        </li>
                      ))}
                      {items.length > max && <li className="px-1 text-[11px] text-bark">{fmt(C.more, { count: items.length - max })}</li>}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Agenda (phones) */}
          <div className="sm:hidden">
            {visibleDays.length === 0 ? (
              <p className="text-sm text-bark">{C.empty}</p>
            ) : (
              <ol className="divide-y divide-ink/8">
                {visibleDays.map((day) => (
                  <li key={day} className="py-2.5">
                    <p className={cn("mb-1.5 text-xs font-semibold", day === today ? "text-lagoon" : "text-bark")}>{formatDay(day)}</p>
                    <ul className="space-y-1">
                      {on(day).map((r) => (
                        <li key={r.id}>
                          <Chip run={r} day={day} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {runs.length === 0 && <p className="mt-3 hidden text-sm text-bark sm:block">{C.empty}</p>}

          <ul aria-label={C.legend} className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-bark">
            {(["upcoming", "full", "done", "cancelled"] as const).map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2.5 rounded-full", DOT_CLS[p])} />
                {C.phases[p]}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">{C.upcomingTitle}</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-bark">{C.upcomingEmpty}</p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {upcoming.map((r) => {
                  const held = r.confirmed + r.pending;
                  return (
                    <li key={r.id}>
                      <Link href={runHref(r)} className="-mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-stone/50">
                        <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT_CLS[r.phase])} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.title}</span>
                          <span className="block text-xs text-bark">
                            {formatDay(r.start, r.time)}
                            {r.end !== r.start && ` → ${shortDay(r.end)}`} ·{" "}
                            {r.capacity != null ? fmt(C.places, { held, capacity: r.capacity }) : fmt(C.placesOpen, { held })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            {/* key: a "+" on another day resets the picked date */}
            <CalendarQuickAdd key={addDate ?? ""} templates={templates} defaultDate={addDate ?? addDays(today, 7)} />
          </Card>
        </div>
      </div>
    </section>
  );
}
