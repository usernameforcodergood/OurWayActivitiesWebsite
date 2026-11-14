import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toPublicAnnouncement } from "@/lib/cms/mappers";
import type { AnnouncementRow } from "@/lib/cms/types";
import { AnnouncementView } from "@/components/news/AnnouncementView";
import { PreviewBanner } from "@/components/ui/PreviewBanner";

export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AnnouncementPreviewPage({ params }: PageProps<"/[locale]/preview/announcements/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(locale)) notFound();
  await requireAdmin();
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("announcements")
    .select("*, image:media!announcements_image_media_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const t = await getDictionary(locale);
  const item = toPublicAnnouncement(data as AnnouncementRow, locale);
  return (
    <>
      <PreviewBanner text={t.common.previewBanner} otherLabel={t.common.previewOther} locale={locale} other={`/${locale === "el" ? "en" : "el"}/preview/announcements/${id}`} />
      <AnnouncementView item={{ ...item, title: item.title || "—" }} locale={locale} t={t} />
    </>
  );
}
