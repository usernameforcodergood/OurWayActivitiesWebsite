import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt, t } from "../_lib/strings";
import type { DepartureGroupRow, ExcursionGroup } from "../_lib/booking-queries";
import { BookingStatusBadge, PaymentStatusBadge, formatDate, formatEurAdmin, formatRun } from "./ui";

const DATE_STATUS_CLS: Record<DepartureGroupRow["status"], string> = {
  open: "bg-emerald-50 text-emerald-900",
  full: "bg-amber-100 text-amber-900",
  cancelled: "bg-red-100 text-red-900",
  completed: "bg-stone text-bark",
};

/**
 * Excursion → date → requests. Each date is a native <details>: one click opens
 * its requests, no JavaScript or extra page needed.
 */
export function DepartureGroups({ groups, openAll, openId }: { groups: ExcursionGroup[]; openAll: boolean; openId: string }) {
  const B = t.bookings;
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.excursionId} aria-labelledby={`ex-${g.excursionId}`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id={`ex-${g.excursionId}`} className="text-lg font-semibold">
              {g.title}
            </h2>
            <Link href={`/admin/excursions/${g.excursionId}`} className="inline-flex items-center gap-1 text-xs font-medium text-bark hover:text-ink">
              <ExternalLink aria-hidden className="size-3.5" /> {B.manageDates}
            </Link>
          </div>
          <ul className="space-y-2">
            {g.dates.map((d) => (
              <li key={d.id}>
                <DateRow d={d} open={openAll || openId === d.id} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DateRow({ d, open }: { d: DepartureGroupRow; open: boolean }) {
  const B = t.bookings;
  const P = t.payments;
  const s = d.summary;
  // Free places only matter while the date still takes bookings.
  const takesBookings = d.status === "open" || d.status === "full";
  const free = d.capacity != null ? Math.max(d.capacity - s.heldPeople, 0) : null;
  const filteredOut = d.requests.length !== s.requests;

  return (
    <details id={`date-${d.id}`} open={open} className={cn("group admin-card overflow-hidden", s.pending > 0 && "ring-2 ring-amber-300")}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-stone/30 sm:px-5 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 shrink-0 text-bark transition group-open:rotate-180" />
        <span className="min-w-[12rem] flex-1 font-semibold">{formatRun(d.departure_date, d.return_date, d.departure_time)}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          {d.status !== "open" && <span className={cn("rounded-full px-2.5 py-0.5 font-semibold", DATE_STATUS_CLS[d.status])}>{B.dateStatus[d.status]}</span>}
          {s.pending > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-900">{fmt(B.datePending, { count: s.pending })}</span>}
          <span className="text-bark">{s.requests === 1 ? B.dateRequestsOne : fmt(B.dateRequests, { count: s.requests })}</span>
          <span className="text-bark">· {fmt(B.dateConfirmed, { count: s.confirmedPeople })}</span>
          {takesBookings && <span className="text-bark">· {free === null ? B.dateNoLimit : fmt(B.dateFree, { free, capacity: d.capacity ?? 0 })}</span>}
        </span>
      </summary>

      <div className="border-t border-ink/10">
        {d.requests.length === 0 ? (
          <p className="px-5 py-4 text-sm text-bark">{B.dateNoRequests}</p>
        ) : (
          <div className="overflow-x-auto">
            {filteredOut && <p className="px-5 pt-3 text-xs text-bark">{fmt(B.dateMatches, { shown: d.requests.length, total: s.requests })}</p>}
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-bark">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-semibold">{B.customer}</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">{B.reference}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">{B.participants}</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">{B.status}</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">{B.submitted}</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">{B.expectedAmount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {d.requests.map((r) => (
                  <tr key={r.id} className={cn("align-top hover:bg-stone/30", r.status === "pending" && "bg-amber-50/70")}>
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/bookings/${r.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-deep-teal">
                      <Link href={`/admin/bookings/${r.id}`} className="hover:underline">
                        {r.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.participants}</td>
                    <td className="px-3 py-2.5">
                      <BookingStatusBadge status={r.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-bark">{formatDate(r.created_at, true)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right">
                      <span className="tabular-nums">{formatEurAdmin(r.expected_total_eur ?? r.total_eur)}</span>
                      {typeof r.payment_status === "string" && r.payment_status !== "unpaid" && (
                        <span className="mt-1 block">
                          <PaymentStatusBadge status={r.payment_status} />
                        </span>
                      )}
                      {r.refund_due && <span className="mt-1 block text-xs text-amber-900">{P.filterRefund}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
