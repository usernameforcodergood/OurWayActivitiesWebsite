import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { t } from "../../../_lib/strings";
import { PageHeader } from "../../../_components/ui";
import { AnnouncementForm } from "../../../_components/AnnouncementForm";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.announcements.new };

export default async function NewAnnouncementPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/announcements" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> {t.announcements.title}
      </Link>
      <PageHeader title={t.announcements.new} />
      <AnnouncementForm row={null} />
    </>
  );
}
