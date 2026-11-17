import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { fmt, t } from "../../../_lib/strings";
import { nowMs } from "../../../_lib/queries";
import { getBookingDetail } from "../../../_lib/booking-queries";
import { BookingActions } from "../../../_components/BookingActions";
import { NotesPanel } from "../../../_components/NotesPanel";
import { EmailCard, HistoryCard } from "../../../_components/RequestLog";
import { BookingStatusBadge, Card, PageHeader, formatDate, formatDay, formatEurAdmin } from "../../../_components/ui";

export const instant = false;
export const metadata: Metadata = { title: t.bookings.title };

export default async function BookingDetailPage({ params }: PageProps<"/admin/bookings/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [detail, now] = await Promise.all([getBookingDetail(id), nowMs()]);
  if (!detail) notFound();
  const { booking: b, history, notes, emails } = detail;
  const B = t.bookings;
  const holdActive = b.hold_expires_at ? new Date(b.hold_expires_at).getTime() > now : false;
  const holdExpired = b.status === "pending" && b.kind === "booking" && !holdActive;
  const title = b.excursion_title_el || b.excursion_title_en || b.excursion_slug;

  const rows: Array<[string, React.ReactNode]> = [
    [B.kind, b.kind === "interest" ? B.kindInterest : B.kindBooking],
    [B.excursion, title],
    [B.departure, b.kind === "interest" ? B.noDate : formatDay(b.departure_date, b.departure_time)],
    [B.participants, b.participants],
    ...(b.unit_price_eur != null ? ([[B.unitPrice, formatEurAdmin(b.unit_price_eur)]] as Array<[string, React.ReactNode]>) : []),
    ...(b.total_eur != null ? ([[B.totalLong, <strong key="t">{formatEurAdmin(b.total_eur)}</strong>]] as Array<[string, React.ReactNode]>) : []),
    [B.submitted, formatDate(b.created_at, true)],
    [B.language, b.locale === "el" ? "Ελληνικά" : "English"],
  ];

  return (
    <>
      <Link href="/admin/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {B.title}
      </Link>
      <PageHeader
        title={fmt(B.detailTitle, { ref: b.reference })}
        description={`${b.full_name} · ${title}`}
        actions={<BookingStatusBadge status={b.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{B.request}</h2>
            <dl className="divide-y divide-ink/8 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[11rem_1fr] gap-3 py-2.5">
                  <dt className="text-bark">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {b.status === "pending" && b.kind === "booking" && b.hold_expires_at && holdActive && (
              <p className="mt-4 rounded-lg bg-sky-50 p-3 text-xs text-sky-950">{fmt(B.holdUntil, { date: formatDate(b.hold_expires_at, true) })}</p>
            )}
            {(b.special_requests || b.message) && (
              <div className="mt-5 space-y-4 border-t border-ink/10 pt-5 text-sm">
                {b.special_requests && (
                  <div>
                    <p className="font-semibold">{B.specialRequests}</p>
                    <p className="mt-1 whitespace-pre-wrap">{b.special_requests}</p>
                  </div>
                )}
                {b.message && (
                  <div>
                    <p className="font-semibold">{B.message}</p>
                    <p className="mt-1 whitespace-pre-wrap">{b.message}</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          <NotesPanel target="booking" id={b.id} notes={notes} />
          <HistoryCard history={history} />
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{B.contact}</h2>
            <p className="font-semibold">{b.full_name}</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a href={`mailto:${b.email}?subject=${encodeURIComponent(`OurWay ${b.reference}`)}`} className="inline-flex items-center gap-2 break-all text-lagoon hover:underline">
                <Mail aria-hidden className="size-4 shrink-0" /> {b.email}
              </a>
              <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-lagoon hover:underline">
                <Phone aria-hidden className="size-4 shrink-0" /> {b.phone}
              </a>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">{B.actions}</h2>
            <BookingActions
              id={b.id}
              reference={b.reference}
              participants={b.participants}
              status={b.status}
              holdExpired={holdExpired}
              canExtend={b.kind === "booking"}
            />
            <Link href={`/admin/excursions/${b.excursion_id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
              <ExternalLink aria-hidden className="size-4" /> {B.viewExcursion}
            </Link>
          </Card>

          <EmailCard emails={emails} resendFor={b.id} />
        </aside>
      </div>
    </>
  );
}
