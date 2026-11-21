import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { BOOKING_STATUSES, INQUIRY_STATUSES, REQUEST_STAGES, type BookingStatus, type RequestStage } from "@/lib/bookings/validation";
import { cn } from "@/lib/utils";
import { fmt, t } from "../../_lib/strings";
import { listBookings, listDepartureOptions, listExcursionOptions, parseBookingParams, type BookingListParams } from "../../_lib/booking-queries";
import { BookingStatusBadge, EmptyState, PaymentStatusBadge, PageHeader, formatDate, formatEurAdmin, formatRun } from "../../_components/ui";

export const instant = false;
export const metadata: Metadata = { title: t.bookings.title };

function href(p: Partial<BookingListParams>) {
  const sp = new URLSearchParams();
  if (p.kind && p.kind !== "all") sp.set("kind", p.kind);
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.stage && p.stage !== "all") sp.set("stage", p.stage);
  if (p.excursion) sp.set("excursion", p.excursion);
  if (p.excursion && p.departure) sp.set("departure", p.departure);
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.sort && p.sort !== "submitted") sp.set("sort", p.sort);
  if (p.payment && p.payment !== "all") sp.set("payment", p.payment);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `/admin/bookings?${s}` : "/admin/bookings";
}

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin();
  const parsed = parseBookingParams(await searchParams);
  const departures = await listDepartureOptions(parsed.excursion);
  // A date left over from a previously chosen excursion is ignored, never matched against another excursion.
  const p: BookingListParams =
    parsed.departure && parsed.departure !== "none" && !departures.some((d) => d.id === parsed.departure) ? { ...parsed, departure: "" } : parsed;
  const [{ rows, total, pages }, excursions] = await Promise.all([listBookings(p), listExcursionOptions()]);
  const filtered = Boolean(p.q || p.excursion || p.departure || p.from || p.to) || p.status !== "all" || p.stage !== "all" || p.payment !== "all";
  const P = t.payments;
  const paymentTabs = [
    ["all", P.filterAll],
    ["open", P.filterOpen],
    ["refund", P.filterRefund],
  ] as const;
  const B = t.bookings;
  const all = p.kind === "all";
  const inquiries = p.kind === "interest";
  const statuses: readonly BookingStatus[] = inquiries ? INQUIRY_STATUSES : BOOKING_STATUSES;
  // "All requests": the four stages. Per kind: that kind's own statuses.
  const tabs: Array<{ key: string; label: string; to: Partial<BookingListParams>; active: boolean }> = all
    ? [
        { key: "all", label: t.common.all, to: { ...p, stage: "all", status: "all", page: 1 }, active: p.stage === "all" && p.status === "all" },
        ...(Object.keys(REQUEST_STAGES) as RequestStage[]).map((s) => ({
          key: s,
          label: B.stages[s],
          to: { ...p, stage: s, status: "all" as const, page: 1 },
          active: p.stage === s,
        })),
      ]
    : [
        { key: "all", label: t.common.all, to: { ...p, status: "all", page: 1 }, active: p.status === "all" },
        ...statuses.map((s) => ({ key: s, label: B.statuses[s], to: { ...p, status: s, page: 1 }, active: p.status === s })),
      ];
  const kinds = [
    ["all", B.tabAll],
    ["booking", B.tabBookings],
    ["interest", B.tabInquiries],
  ] as const;

  return (
    <>
      <PageHeader title={B.title} description={B.intro} />

      <nav aria-label={B.kindTabs} className="mb-3 flex flex-wrap gap-2 border-b border-ink/10">
        {kinds.map(([key, label]) => (
          <Link
            key={key}
            href={href({ kind: key })}
            aria-current={p.kind === key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold",
              p.kind === key ? "border-forest text-ink" : "border-transparent text-bark hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-xs text-bark">{all ? B.tabAllHint : inquiries ? B.tabInquiriesHint : B.tabBookingsHint}</p>

      <div className="mb-5 space-y-3">
        <nav aria-label={B.status} className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={href(tab.to)}
              aria-current={tab.active ? "true" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium",
                tab.active ? "bg-forest text-bone" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-stone/60",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <nav aria-label={P.filterLabel} className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-bark">{P.filterLabel}</span>
          {paymentTabs.map(([key, label]) => (
            <Link
              key={key}
              href={href({ ...p, payment: key, page: 1 })}
              aria-current={p.payment === key ? "true" : undefined}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                p.payment === key ? "bg-forest text-bone" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-stone/60",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/bookings" className="grid gap-2 md:grid-cols-[1fr_14rem] lg:grid-cols-[1fr_14rem_14rem_9.5rem_9.5rem_12rem_auto]">
          {!all && <input type="hidden" name="kind" value={p.kind} />}
          {p.status !== "all" && <input type="hidden" name="status" value={p.status} />}
          {p.stage !== "all" && <input type="hidden" name="stage" value={p.stage} />}
          {p.payment !== "all" && <input type="hidden" name="payment" value={p.payment} />}
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bark" />
            <label htmlFor="bq" className="sr-only">
              {t.common.search}
            </label>
            <input id="bq" name="q" type="search" defaultValue={p.q} placeholder={B.searchPlaceholder} className="admin-input pl-9" />
          </div>
          <label htmlFor="bex" className="sr-only">
            {B.excursion}
          </label>
          <select id="bex" name="excursion" defaultValue={p.excursion} className="admin-input">
            <option value="">{B.allExcursions}</option>
            {excursions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title_el || e.title_en || e.slug}
              </option>
            ))}
          </select>
          <label htmlFor="bdep" className="sr-only">
            {B.runFilter}
          </label>
          <select id="bdep" name="departure" defaultValue={p.departure} disabled={!p.excursion} title={p.excursion ? B.runFilter : B.runFilterHint} className="admin-input disabled:opacity-50">
            <option value="">{p.excursion ? B.allRuns : B.runFilterHint}</option>
            {departures.map((d) => (
              <option key={d.id} value={d.id}>
                {formatRun(d.departure_date, d.return_date, d.departure_time)}
                {d.status === "cancelled" ? ` (${B.runCancelled})` : d.status === "completed" ? ` (${B.runCompleted})` : ""}
              </option>
            ))}
            {p.excursion && <option value="none">{B.noDateRequests}</option>}
          </select>
          {!inquiries && (
            <>
              <input type="date" name="from" defaultValue={p.from} aria-label={B.departureFrom} title={B.departureFrom} className="admin-input" />
              <input type="date" name="to" defaultValue={p.to} aria-label={`${B.departureFrom} — ${B.departureTo}`} title={B.departureTo} className="admin-input" />
            </>
          )}
          <label htmlFor="bsort" className="sr-only">
            {t.common.sortBy}
          </label>
          <select id="bsort" name="sort" defaultValue={p.sort} className="admin-input">
            <option value="submitted">{B.sortSubmitted}</option>
            <option value="submitted_asc">{B.sortSubmittedAsc}</option>
            {!inquiries && <option value="departure">{B.sortDeparture}</option>}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="min-h-10 flex-1 rounded-lg bg-forest px-4 text-sm font-semibold text-bone hover:bg-moss">
              {B.filter}
            </button>
            {filtered && (
              <Link href={href({ kind: p.kind })} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-bark ring-1 ring-ink/10 hover:bg-stone/60">
                {B.clear}
              </Link>
            )}
          </div>
        </form>
        <p className="text-xs text-bark">{fmt(t.common.results, { count: total })}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={filtered ? B.emptyFiltered : B.empty} />
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[68rem] text-left text-sm">
            <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-bark">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{B.customer}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.excursion}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{inquiries ? B.preferredPeriod : B.excursionDate}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{B.participants}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{B.total}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.status}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{P.columnPayment}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.submitted}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-stone/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${r.id}`} className="block font-semibold text-ink underline-offset-2 hover:underline">
                      {r.full_name}
                    </Link>
                    <span className="block font-mono text-xs text-deep-teal">{r.reference}</span>
                    <a href={`mailto:${r.email}`} className="block text-xs text-bark hover:text-ink">
                      {r.email}
                    </a>
                    <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="block text-xs text-bark hover:text-ink">
                      {r.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/excursions/${r.excursion_id}#requests`} className="font-medium underline-offset-2 hover:underline">
                      {r.excursion_title_el || r.excursion_title_en || r.excursion_slug}
                    </Link>
                    {all && <span className="mt-0.5 block text-xs text-bark">{r.kind === "interest" ? B.kindShortInterest : B.kindShortBooking}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.departure_id ? (
                      formatRun(r.departure_date, r.return_date, r.departure_time)
                    ) : (
                      <span className="text-bark">
                        {B.noDate}
                        {r.preferred_period && <span className="block text-xs">{fmt(B.preferredShort, { period: r.preferred_period })}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.participants}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatEurAdmin(r.total_eur)}</td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {typeof r.payment_status === "string" ? (
                      <>
                        <PaymentStatusBadge status={r.payment_status} />
                        {(r.payment_open || r.refund_due) && (
                          <span className="mt-1 block text-xs tabular-nums text-bark">
                            {r.refund_due ? `${P.filterRefund}: ${formatEurAdmin(r.net_paid_eur)}` : `${P.balance}: ${formatEurAdmin(r.balance_eur)}`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-bark">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-bark">{formatDate(r.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="pagination" className="mt-6 flex items-center justify-between gap-3">
          {p.page > 1 ? (
            <Link href={href({ ...p, page: p.page - 1 })} className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink/10 hover:bg-stone/60">
              ← {t.common.prev}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-bark">{fmt(t.common.page, { page: p.page, pages })}</span>
          {p.page < pages ? (
            <Link href={href({ ...p, page: p.page + 1 })} className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink/10 hover:bg-stone/60">
              {t.common.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
