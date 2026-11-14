import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { t } from "../../../_lib/strings";
import { PageHeader } from "../../../_components/ui";
import { ExcursionForm } from "../../../_components/ExcursionForm";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.excursions.new };

export default async function NewExcursionPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/excursions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.excursions.title}
      </Link>
      <PageHeader title={t.excursions.new} />
      <ExcursionForm row={null} />
    </>
  );
}
