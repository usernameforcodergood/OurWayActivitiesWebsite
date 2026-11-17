import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { fmt, t } from "../../../_lib/strings";
import { getPrivateRequestDetail } from "../../../_lib/booking-queries";
import { NotesPanel } from "../../../_components/NotesPanel";
import { EmailCard, HistoryCard } from "../../../_components/RequestLog";
import { PrivateStatusControl, ProposalForm } from "../../../_components/PrivateRequestControls";
import { Card, PageHeader, PrivateStatusBadge, formatDate, formatDay } from "../../../_components/ui";

export const instant = false;
export const metadata: Metadata = { title: t.privateRequests.title };

export default async function PrivateRequestDetailPage({ params }: PageProps<"/admin/private-requests/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getPrivateRequestDetail(id);
  if (!detail) notFound();
  const { request: r, history, notes, emails } = detail;
  const P = t.privateRequests;
  const name = `${r.first_name} ${r.last_name}`;

  const dates = [
    r.date_from ? `${formatDay(r.date_from)}${r.date_to ? ` – ${formatDay(r.date_to)}` : ""}` : null,
    r.dates_flexible ? P.flexible : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const prefs: Array<[string, string | null]> = [
    [P.group, fmt(P.people, { count: r.participants })],
    [P.destination, [r.destination, r.destination_flexible ? P.flexible : null].filter(Boolean).join(" · ") || null],
    [P.dates, dates || null],
    [P.type, r.excursion_type],
    [P.duration, r.duration],
    [P.difficulty, r.difficulty],
    [P.transport, r.transport],
    [P.budget, r.budget_per_person],
    [P.activities, r.activities],
    [P.message, r.message],
    [t.bookings.submitted, formatDate(r.created_at, true)],
    [t.bookings.language, r.locale === "el" ? "Ελληνικά" : "English"],
  ];

  return (
    <>
      <Link href="/admin/private-requests" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {P.title}
      </Link>
      <PageHeader title={fmt(P.detailTitle, { ref: r.reference })} description={name} actions={<PrivateStatusBadge status={r.status} />} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{P.preferences}</h2>
            <dl className="divide-y divide-ink/8 text-sm">
              {prefs
                .filter((x): x is [string, string] => Boolean(x[1]))
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[11rem_1fr] gap-3 py-2.5">
                    <dt className="text-bark">{k}</dt>
                    <dd className="whitespace-pre-wrap">{v}</dd>
                  </div>
                ))}
            </dl>
          </Card>
          <ProposalForm id={r.id} initial={r} />
          <NotesPanel target="private" id={r.id} notes={notes} />
          <HistoryCard history={history} />
        </div>
        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{t.bookings.contact}</h2>
            <p className="font-semibold">{name}</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <a href={`mailto:${r.email}?subject=${encodeURIComponent(`OurWay ${r.reference}`)}`} className="inline-flex items-center gap-2 break-all text-lagoon hover:underline">
                <Mail aria-hidden className="size-4 shrink-0" /> {r.email}
              </a>
              <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-lagoon hover:underline">
                <Phone aria-hidden className="size-4 shrink-0" /> {r.phone}
              </a>
            </div>
          </Card>
          <Card>
            <PrivateStatusControl id={r.id} status={r.status} />
          </Card>
          <EmailCard emails={emails} />
        </aside>
      </div>
    </>
  );
}
