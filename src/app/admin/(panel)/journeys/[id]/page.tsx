import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { t } from "../../../_lib/strings";
import { getJourneyById, getJourneyOptions } from "../../../_lib/journey-queries";
import { PageHeader } from "../../../_components/ui";
import { JourneyForm } from "../../../_components/JourneyForm";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.journeys.editTitle };

export default async function EditJourneyPage({ params }: PageProps<"/admin/journeys/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [row, { excursions, departures }] = await Promise.all([getJourneyById(id), getJourneyOptions()]);
  if (!row) notFound();
  return (
    <>
      <Link href="/admin/journeys" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.journeys.title}
      </Link>
      <PageHeader title={row.title_el || row.title_en || t.journeys.editTitle} />
      {/* key: reset local form state when a different record loads */}
      <JourneyForm key={row.id + row.updated_at} row={row} excursions={excursions} departures={departures} />
    </>
  );
}
