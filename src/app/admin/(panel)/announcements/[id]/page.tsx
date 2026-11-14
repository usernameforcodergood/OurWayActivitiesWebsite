import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { t } from "../../../_lib/strings";
import { getAnnouncementById } from "../../../_lib/queries";
import { PageHeader } from "../../../_components/ui";
import { AnnouncementForm } from "../../../_components/AnnouncementForm";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.announcements.editTitle };

export default async function EditAnnouncementPage({ params }: PageProps<"/admin/announcements/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const row = await getAnnouncementById(id);
  if (!row) notFound();

  return (
    <>
      <Link href="/admin/announcements" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.announcements.title}
      </Link>
      <PageHeader title={row.title_el || row.title_en || t.announcements.editTitle} />
      {/* key: reset local form state when a different record loads */}
      <AnnouncementForm key={row.id + row.updated_at} row={row} />
    </>
  );
}
