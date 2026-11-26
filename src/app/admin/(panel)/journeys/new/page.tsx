import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { t } from "../../../_lib/strings";
import { getJourneyOptions } from "../../../_lib/journey-queries";
import { PageHeader } from "../../../_components/ui";
import { JourneyForm } from "../../../_components/JourneyForm";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.journeys.new };

export default async function NewJourneyPage() {
  await requireAdmin();
  const { excursions, departures } = await getJourneyOptions();
  return (
    <>
      <Link href="/admin/journeys" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.journeys.title}
      </Link>
      <PageHeader title={t.journeys.new} description={t.journeys.intro} />
      <JourneyForm row={null} excursions={excursions} departures={departures} />
    </>
  );
}
