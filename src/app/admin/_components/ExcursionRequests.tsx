import Link from "next/link";
import { ChevronDown, ExternalLink, List, Mail, Phone } from "lucide-react";
import type { BOOKING_STATUSES, InquiryStatus } from "@/lib/bookings/validation";
import { fmt, t } from "../_lib/strings";
import type { BookingOverviewRow } from "../_lib/booking-queries";
import { BookingActions } from "./BookingActions";
import { InquiryStatusControl } from "./InquiryStatusControl";
import { BookingStatusBadge, Card, formatDate, formatRun } from "./ui";

type BookingOnlyStatus = (typeof BOOKING_STATUSES)[number];
const B = t.bookings;
const P = t.bookings.perExcursion;
const NEW = new Set(["pending", "new"]);

type Group = { key: string; departureId: string | null; date: string | null; label: string; rows: BookingOverviewRow[] };

/**
 * Everyone who asked about one excursion, grouped by run (departure_id) and
 * then the requests without a date. Rows come from booking_overview filtered
 * on excursion_id, so only requests linked to this excursion in the database
 * appear here.
 */
export function ExcursionRequests({ excursionId, rows, today, now }: { excursionId: string; rows: BookingOverviewRow[]; today: string; now: number }) {
  const people = rows.reduce((a, r) => a + r.participants, 0);
  const fresh = rows.filter((r) => NEW.has(r.status)).length;

  const byRun = new Map<string, Group>();
  for (const r of rows) {
    const key = r.departure_id ?? "none";
    let g = byRun.get(key);
    if (!g) {
      g = {
        key,
        departureId: r.departure_id,
        date: r.departure_date,
        label: r.departure_id ? formatRun(r.departure_date, r.return_date, r.departure_time) : P.noDateGroup,
        rows: [],
      };
      byRun.set(key, g);
    }
    g.rows.push(r);
  }
  // Upcoming runs (soonest first), then past runs (latest first), then requests without a date.
  const groups = [...byRun.values()].sort((a, b) => {
    if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
    const au = a.date >= today, bu = b.date >= today;
    if (au !== bu) return au ? -1 : 1;
    return au ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });

  return (
    <Card>
      <div id="requests" className="scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{P.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-bark">{P.intro}</p>
          </div>
          {rows.length > 0 && (
            <Link href={`/admin/bookings?excursion=${excursionId}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-ink/10 hover:bg-stone/60">
              <List aria-hidden className="size-4" /> {P.inList}
            </Link>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="mt-5 rounded-lg bg-stone/40 p-4 text-sm text-bark">{P.empty}</p>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium">{fmt(P.summary, { requests: rows.length, people, fresh })}</p>
            <div className="mt-5 space-y-6">
              {groups.map((g) => (
                <section key={g.key} aria-label={g.label}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 pb-2">
                    <h3 className="font-semibold">
                      {g.label}
                      {g.date && g.date < today && <span className="ml-2 text-xs font-normal text-bark">({B.runCompleted})</span>}
                    </h3>
                    <span className="flex items-center gap-3 text-xs text-bark">
                      {fmt(P.groupSummary, { requests: g.rows.length, people: g.rows.reduce((a, r) => a + r.participants, 0) })}
                      <Link
                        href={`/admin/bookings?excursion=${excursionId}&departure=${g.departureId ?? "none"}`}
                        className="text-deep-teal underline-offset-2 hover:underline"
                      >
                        {P.inList}
                      </Link>
                    </span>
                  </div>
                  <ul className="divide-y divide-ink/8">
                    {g.rows.map((r) => (
                      <RequestRow key={r.id} r={r} now={now} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function RequestRow({ r, now }: { r: BookingOverviewRow; now: number }) {
  const holdExpired = r.kind === "booking" && r.status === "pending" && (!r.hold_expires_at || new Date(r.hold_expires_at).getTime() <= now);
  return (
    <li>
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3 hover:bg-stone/30 sm:grid-cols-[minmax(0,1.6fr)_5rem_9rem_9rem_1.25rem] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{r.full_name}</span>
            <span className="block font-mono text-xs text-deep-teal">{r.reference}</span>
          </span>
          <span className="text-sm tabular-nums sm:text-right">
            {r.participants} {B.participants.toLowerCase()}
          </span>
          <span className="sm:order-none">
            <BookingStatusBadge status={r.status} />
          </span>
          <span className="text-xs text-bark">{formatDate(r.created_at, true)}</span>
          <ChevronDown aria-hidden className="hidden size-4 text-bark transition-transform group-open:rotate-180 sm:block" />
        </summary>

        <div className="mb-4 grid gap-5 rounded-lg bg-stone/30 p-4 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a href={`mailto:${r.email}?subject=${encodeURIComponent(`OurWay ${r.reference}`)}`} className="inline-flex items-center gap-1.5 break-all text-deep-teal hover:underline">
                <Mail aria-hidden className="size-4 shrink-0" /> {r.email}
              </a>
              <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-deep-teal hover:underline">
                <Phone aria-hidden className="size-4 shrink-0" /> {r.phone}
              </a>
            </div>
            {r.preferred_period && (
              <p>
                <span className="font-semibold">{B.preferredPeriod}:</span> {r.preferred_period}
              </p>
            )}
            {r.special_requests && (
              <div>
                <p className="font-semibold">{B.specialRequests}</p>
                <p className="mt-1 whitespace-pre-wrap">{r.special_requests}</p>
              </div>
            )}
            <div>
              <p className="font-semibold">{B.message}</p>
              <p className="mt-1 whitespace-pre-wrap">{r.message || <span className="text-bark">{P.noMessage}</span>}</p>
            </div>
            <Link href={`/admin/bookings/${r.id}`} className="inline-flex items-center gap-1.5 font-medium text-ink underline-offset-2 hover:underline">
              <ExternalLink aria-hidden className="size-4" /> {P.open}
            </Link>
          </div>
          <div>
            {r.kind === "interest" ? (
              <InquiryStatusControl id={r.id} status={r.status as InquiryStatus} idPrefix={`inq-${r.id}`} />
            ) : (
              <BookingActions id={r.id} reference={r.reference} participants={r.participants} status={r.status as BookingOnlyStatus} holdExpired={holdExpired} canExtend />
            )}
          </div>
        </div>
      </details>
    </li>
  );
}
