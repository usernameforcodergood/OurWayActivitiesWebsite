import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { BOOKING_STATUSES, INQUIRY_STATUSES, type BookingStatus } from "@/lib/bookings/validation";
import { cn } from "@/lib/utils";
import { fmt, t } from "../../_lib/strings";
import { listBookings, listExcursionOptions, parseBookingParams, type BookingListParams } from "../../_lib/booking-queries";
import { BookingStatusBadge, EmptyState, PageHeader, formatDate, formatDay, formatEurAdmin } from "../../_components/ui";

export const instant = false;
export const metadata: Metadata = { title: t.bookings.title };

function href(p: Partial<BookingListParams>) {
  const sp = new URLSearchParams();
  if (p.kind === "interest") sp.set("kind", "interest");
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.excursion) sp.set("excursion", p.excursion);
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.sort && p.sort !== "submitted") sp.set("sort", p.sort);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `/admin/bookings?${s}` : "/admin/bookings";
}

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin();
  const p = parseBookingParams(await searchParams);
  const [{ rows, total, pages }, excursions] = await Promise.all([listBookings(p), listExcursionOptions()]);
  const filtered = Boolean(p.q || p.excursion || p.from || p.to) || p.status !== "all";
  const B = t.bookings;
  const inquiries = p.kind === "interest";
  const statuses: readonly BookingStatus[] = inquiries ? INQUIRY_STATUSES : BOOKING_STATUSES;
  const tabs: Array<["all" | BookingStatus, string]> = [["all", t.common.all], ...statuses.map((s) => [s, B.statuses[s]] as ["all" | BookingStatus, string])];
  const kinds = [
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
      <p className="mb-4 text-xs text-bark">{inquiries ? B.tabInquiriesHint : B.tabBookingsHint}</p>

      <div className="mb-5 space-y-3">
        <nav aria-label={B.status} className="flex flex-wrap gap-1">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={href({ ...p, status: key, page: 1 })}
              aria-current={p.status === key ? "true" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium",
                p.status === key ? "bg-forest text-bone" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-stone/60",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/bookings" className="grid gap-2 md:grid-cols-[1fr_14rem] lg:grid-cols-[1fr_14rem_9.5rem_9.5rem_12rem_auto]">
          {inquiries && <input type="hidden" name="kind" value="interest" />}
          {p.status !== "all" && <input type="hidden" name="status" value={p.status} />}
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
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-bark">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{B.reference}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.customer}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.excursion}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{inquiries ? B.preferredPeriod : B.departure}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{B.participants}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{B.total}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.status}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.submitted}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-stone/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${r.id}`} className="font-mono font-semibold text-lagoon underline-offset-2 hover:underline">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{r.full_name}</span>
                    <a href={`mailto:${r.email}`} className="block text-xs text-bark hover:text-ink">
                      {r.email}
                    </a>
                    <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="block text-xs text-bark hover:text-ink">
                      {r.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3">{r.excursion_title_el || r.excursion_title_en || r.excursion_slug}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.kind === "interest" ? <span className="text-bark">{r.preferred_period || B.notGiven}</span> : formatDay(r.departure_date, r.departure_time)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.participants}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatEurAdmin(r.total_eur)}</td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={r.status} />
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
