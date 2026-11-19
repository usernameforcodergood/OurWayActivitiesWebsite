import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Pencil, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { fmt, t } from "../../../_lib/strings";
import { getPrivateRequestDetail } from "../../../_lib/booking-queries";
import { NotesPanel } from "../../../_components/NotesPanel";
import { EmailCard, HistoryCard } from "../../../_components/RequestLog";
import { DeleteTailorMadeButton, PrivateStatusControl, ProposalForm, TailorMadeDetailsForm } from "../../../_components/TailorMadeControls";
import { Card, PageHeader, PrivateStatusBadge, formatDate, formatDay } from "../../../_components/ui";

export const instant = false;
export const metadata: Metadata = { title: t.privateRequests.title };

export default async function TailorMadeDetailPage({ params }: PageProps<"/admin/tailor-made/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getPrivateRequestDetail(id);
  if (!detail) notFound();
  const { request: r, history, notes, emails } = detail;
  const P = t.privateRequests;
  const name = `${r.first_name} ${r.last_name}`;

  const dates = [
    r.date_from ? `${formatDay(r.date_from)}${r.date_to && r.date_to !== r.date_from ? ` – ${formatDay(r.date_to)}` : ""}` : null,
    r.dates_flexible ? P.flexible : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const rows: Array<[string, string | null]> = [
    [P.name, name],
    [P.email, r.email],
    [P.phone, r.phone],
    [P.destination, [r.destination, r.destination_flexible ? P.flexible : null].filter(Boolean).join(" · ") || null],
    [P.dates, dates || null],
    [P.participants, fmt(P.people, { count: r.participants })],
    [P.category, r.experience_type ? P.types[r.experience_type] : null],
    [P.budget, r.budget_per_person],
    [P.description, r.message],
    [P.additional, r.additional_requirements],
    [P.submitted, formatDate(r.created_at, true)],
    [P.statusLabel, P.statuses[r.status]],
    [t.bookings.language, r.locale === "el" ? "Ελληνικά" : "English"],
  ];
  // Fields from the earlier "private trips" form, shown only when present.
  const legacy: Array<[string, string | null]> = [
    [P.type, r.excursion_type],
    [P.duration, r.duration],
    [P.difficulty, r.difficulty],
    [P.transport, r.transport],
    [P.activities, r.activities],
  ];
  const legacyRows = legacy.filter((x): x is [string, string] => Boolean(x[1]));

  return (
    <>
      <Link href="/admin/tailor-made" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {P.title}
      </Link>
      <PageHeader title={fmt(P.detailTitle, { ref: r.reference })} description={name} actions={<PrivateStatusBadge status={r.status} />} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{P.preferences}</h2>
            <dl className="divide-y divide-ink/8 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
                  <dt className="text-bark">{k}</dt>
                  <dd className="whitespace-pre-wrap break-words">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {legacyRows.length > 0 && (
              <>
                <h3 className="mb-2 mt-6 text-sm font-semibold text-bark">{P.legacy}</h3>
                <dl className="divide-y divide-ink/8 text-sm">
                  {legacyRows.map(([k, v]) => (
                    <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
                      <dt className="text-bark">{k}</dt>
                      <dd className="whitespace-pre-wrap break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            <details className="group mt-6 border-t border-ink/8 pt-4">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-deep-teal hover:underline [&::-webkit-details-marker]:hidden">
                <Pencil aria-hidden className="size-4" /> {P.editDetails}
              </summary>
              <div className="mt-4">
                {/* key: reset the form after a save refreshes the data */}
                <TailorMadeDetailsForm key={r.updated_at} request={r} />
              </div>
            </details>
          </Card>
          <ProposalForm id={r.id} initial={r} />
          <NotesPanel target="private" id={r.id} notes={notes} />
          <HistoryCard history={history} kind="private" />
        </div>
        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{t.bookings.contact}</h2>
            <p className="font-semibold">{name}</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a href={`mailto:${r.email}?subject=${encodeURIComponent(`OurWay ${r.reference}`)}`} className="inline-flex items-center gap-2 break-all text-deep-teal hover:underline">
                <Mail aria-hidden className="size-4 shrink-0" /> {r.email}
              </a>
              <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-deep-teal hover:underline">
                <Phone aria-hidden className="size-4 shrink-0" /> {r.phone}
              </a>
            </div>
          </Card>
          <Card>
            <PrivateStatusControl key={r.status} id={r.id} status={r.status} />
          </Card>
          <EmailCard emails={emails} />
          <Card>
            <DeleteTailorMadeButton id={r.id} reference={r.reference} />
          </Card>
        </aside>
      </div>
    </>
  );
}
