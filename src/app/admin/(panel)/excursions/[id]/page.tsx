import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { athensToday } from "@/lib/cms/public";
import { t } from "../../../_lib/strings";
import { getExcursionById } from "../../../_lib/queries";
import { PageHeader } from "../../../_components/ui";
import { ExcursionForm } from "../../../_components/ExcursionForm";
import { DeparturesManager, type OpenRequest } from "../../../_components/DeparturesManager";
import { getDeparturesWithStats } from "../../../_lib/booking-queries";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.excursions.editTitle };

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export default async function EditExcursionPage({ params, searchParams }: PageProps<"/admin/excursions/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const row = await getExcursionById(id);
  if (!row) notFound();
  const [departures, today] = await Promise.all([getDeparturesWithStats(row.id), athensToday()]);
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const defaultPrice = num(row.price_eur);
  const defaultDeposit = num(row.deposit_eur);

  // ?newDate=YYYY-MM-DD (or ?newDate=) opens "new date"; ?repeat=<id> repeats a run; ?departure=<id> highlights one.
  const open: OpenRequest | undefined =
    isUuid(sp.departure) ? { focusId: sp.departure }
    : isUuid(sp.repeat) ? { repeatId: sp.repeat, newDate: isDate(sp.newDate) ? sp.newDate : "" }
    : typeof sp.newDate === "string" ? { newDate: isDate(sp.newDate) ? sp.newDate : "" }
    : undefined;

  return (
    <>
      <Link href="/admin/excursions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.excursions.title}
      </Link>
      <PageHeader title={row.title_el || row.title_en || t.excursions.editTitle} />
      {/* key: reset local form state when a different record loads */}
      <ExcursionForm key={row.id + row.updated_at} row={row} />
      {(row.booking_mode === "departures" || departures.length > 0) && (
        <div className="mt-6">
          <DeparturesManager excursionId={row.id} rows={departures} defaultPrice={defaultPrice} defaultDeposit={defaultDeposit} today={today} open={open} />
        </div>
      )}
    </>
  );
}
