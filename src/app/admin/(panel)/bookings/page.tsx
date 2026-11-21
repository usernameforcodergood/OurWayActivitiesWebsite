import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { athensToday } from "@/lib/cms/public";
import { BOOKING_STATUSES, INQUIRY_STATUSES } from "@/lib/bookings/validation";
import { cn } from "@/lib/utils";
import { fmt, t } from "../../_lib/strings";
import {
  countInquiryPayments,
  getSectionCounts,
  hasAnyFilter,
  hasRequestFilters,
  listDepartureGroups,
  listExcursionOptions,
  listInquiries,
  parseBookingParams,
  type BookingListParams,
  type DepartureWindow,
} from "../../_lib/booking-queries";
import { BookingFilters } from "../../_components/BookingFilters";
import { DepartureGroups } from "../../_components/DepartureGroups";
import { BookingStatusBadge, EmptyState, PageHeader, PaymentStatusBadge, formatDate, formatEurAdmin } from "../../_components/ui";

export const instant = false;
export const metadata: Metadata = { title: t.bookings.title };

/** URL for the page; only non-default values are written. */
function href(p: Partial<BookingListParams>) {
  const sp = new URLSearchParams();
  if (p.section === "inquiries") sp.set("section", "inquiries");
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.when) sp.set("when", p.when);
  if (p.showEmpty) sp.set("empty", "1");
  if (p.excursion) sp.set("excursion", p.excursion);
  if (p.departure) sp.set("departure", p.departure);
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.sfrom) sp.set("sfrom", p.sfrom);
  if (p.sto) sp.set("sto", p.sto);
  if (p.sort) sp.set("sort", p.sort);
  if (p.payment && p.payment !== "all") sp.set("payment", p.payment);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `/admin/bookings?${s}` : "/admin/bookings";
}

function Pill({ href: to, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium", active ? "bg-forest text-bone" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-stone/60")}
    >
      {children}
    </Link>
  );
}

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin();
  const p = parseBookingParams(await searchParams);
  const B = t.bookings;
  const inquiries = p.section === "inquiries";
  const [today, counts, excursions] = await Promise.all([athensToday(), getSectionCounts(), listExcursionOptions()]);

  const sections = [
    { key: "bookings" as const, label: B.sectionBookings, badge: counts.pendingBookings ? fmt(B.attentionPending, { count: counts.pendingBookings }) : null },
    { key: "inquiries" as const, label: B.sectionInquiries, badge: counts.newInquiries ? fmt(B.attentionNew, { count: counts.newInquiries }) : null },
  ];

  const statusOptions = (inquiries ? INQUIRY_STATUSES : BOOKING_STATUSES).map((s) => ({ value: s, label: B.statuses[s] }));
  const sortOptions = inquiries
    ? [
        { value: "", label: B.sortSubmitted },
        { value: "submitted_asc", label: B.sortSubmittedAsc },
      ]
    : [
        { value: "", label: `${B.sortDateAsc}` },
        { value: "date_desc", label: B.sortDateDesc },
      ];

  const filters = (
    <BookingFilters
      hidden={{ section: inquiries ? "inquiries" : "", when: p.when ?? "", empty: p.showEmpty ? "1" : "", departure: p.departure }}
      values={{ q: p.q, status: p.status, excursion: p.excursion, from: p.from, to: p.to, sfrom: p.sfrom, sto: p.sto, sort: p.sort, payment: p.payment }}
      statuses={statusOptions}
      excursions={excursions.map((e) => ({ value: e.id, label: e.title_el || e.title_en || e.slug }))}
      sorts={sortOptions}
      withDepartureRange={!inquiries}
      clearHref={hasAnyFilter(p) ? href({ section: p.section }) : null}
    />
  );

  return (
    <>
      <PageHeader title={B.title} />

      <nav aria-label={B.sections} className="mb-5 flex flex-wrap gap-2 border-b border-ink/10">
        {sections.map((s) => (
          <Link
            key={s.key}
            href={href({ section: s.key })}
            aria-current={p.section === s.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold",
              p.section === s.key ? "border-forest text-ink" : "border-transparent text-bark hover:text-ink",
            )}
          >
            {s.label}
            {s.badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{s.badge}</span>}
          </Link>
        ))}
      </nav>

      {inquiries ? <InquiriesSection p={p} filters={filters} /> : <BookingsSection p={p} today={today} filters={filters} />}
    </>
  );
}

async function BookingsSection({ p, today, filters }: { p: BookingListParams; today: string; filters: React.ReactNode }) {
  const B = t.bookings;
  const [{ window: win, groups, shownDates, truncated }, inquiryPayments] = await Promise.all([
    listDepartureGroups(p, today),
    p.payment !== "all" ? countInquiryPayments(p.payment) : Promise.resolve(0),
  ]);
  const windows: Array<[DepartureWindow, string]> = [
    ["upcoming", B.whenUpcoming],
    ["past", B.whenPast],
    ["all", B.whenAll],
  ];
  const filtered = hasRequestFilters(p);

  return (
    <>
      <p className="mb-4 text-sm text-bark">{B.sectionBookingsHint}</p>
      <div className="mb-4">{filters}</div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={B.windowLabel} className="flex flex-wrap gap-1">
          {windows.map(([w, label]) => (
            <Pill key={w} href={href({ ...p, when: w })} active={win === w}>
              {label}
            </Pill>
          ))}
        </nav>
        {!filtered && (
          <Link href={href({ ...p, showEmpty: !p.showEmpty })} className="text-sm font-medium text-deep-teal underline-offset-2 hover:underline">
            {p.showEmpty ? B.hideEmpty : B.showEmpty}
          </Link>
        )}
      </div>

      {p.departure && (
        <p className="mb-4">
          <Link href={href({ section: "bookings" })} className="text-sm font-medium text-deep-teal underline-offset-2 hover:underline">
            ← {B.allRuns}
          </Link>
        </p>
      )}

      {inquiryPayments > 0 && (
        <p className="mb-4">
          <Link href={href({ section: "inquiries", payment: p.payment })} className="text-sm font-medium text-deep-teal underline-offset-2 hover:underline">
            {fmt(B.inquiriesWithPayment, { count: inquiryPayments })}
          </Link>
        </p>
      )}

      {shownDates === 0 ? (
        <EmptyState title={filtered || hasAnyFilter(p) ? B.emptyFiltered : win === "past" ? B.emptyPast : win === "all" ? B.emptyAll : B.emptyUpcoming} />
      ) : (
        <DepartureGroups groups={groups} openAll={filtered} openId={p.departure} />
      )}
      {truncated && <p className="mt-4 text-xs text-bark">{B.truncated}</p>}
    </>
  );
}

async function InquiriesSection({ p, filters }: { p: BookingListParams; filters: React.ReactNode }) {
  const B = t.bookings;
  const { rows, total, pages } = await listInquiries(p);

  return (
    <>
      <p className="mb-4 text-sm text-bark">{B.sectionInquiriesHint}</p>
      <div className="mb-4">{filters}</div>
      <p className="mb-3 text-xs text-bark">{fmt(t.common.results, { count: total })}</p>

      {rows.length === 0 ? (
        <EmptyState title={hasAnyFilter(p) ? B.emptyFiltered : B.emptyInquiries} />
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-bark">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{B.customer}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.excursion}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.preferredPeriod}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{B.participants}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.status}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{B.submitted}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{B.expectedAmount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map((r) => (
                <tr key={r.id} className={cn("align-top hover:bg-stone/30", r.status === "new" && "bg-amber-50/70")}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${r.id}`} className="block font-semibold text-ink underline-offset-2 hover:underline">
                      {r.full_name}
                    </Link>
                    <span className="block font-mono text-xs text-deep-teal">{r.reference}</span>
                  </td>
                  <td className="px-4 py-3">{r.excursion_title_el || r.excursion_title_en || r.excursion_slug}</td>
                  <td className="px-4 py-3 text-bark">{r.preferred_period || B.notGiven}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.participants}</td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-bark">{formatDate(r.created_at, true)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="tabular-nums">{formatEurAdmin(r.expected_total_eur)}</span>
                    {typeof r.payment_status === "string" && r.payment_status !== "unpaid" && (
                      <span className="mt-1 block">
                        <PaymentStatusBadge status={r.payment_status} />
                      </span>
                    )}
                  </td>
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
