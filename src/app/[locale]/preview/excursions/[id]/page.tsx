import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toPublicExcursion } from "@/lib/cms/mappers";
import type { ExcursionRow } from "@/lib/cms/types";
import { ExcursionView } from "@/components/activities/ExcursionView";
import { PreviewBanner } from "@/components/ui/PreviewBanner";

export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Admin-only preview of a (possibly draft) excursion in the real site design. */
export default async function ExcursionPreviewPage({ params }: PageProps<"/[locale]/preview/excursions/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(locale)) notFound();
  await requireAdmin();
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("excursions")
    .select("*, cover:media!excursions_cover_media_id_fkey(*), images:excursion_images(position, media(*))")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const t = await getDictionary(locale);
  const ex = toPublicExcursion(data as ExcursionRow, locale);
  return (
    <>
      <PreviewBanner text={t.common.previewBanner} otherLabel={t.common.previewOther} locale={locale} other={`/${locale === "el" ? "en" : "el"}/preview/excursions/${id}`} />
      <ExcursionView excursion={{ ...ex, title: ex.title || "—", summary: ex.summary || "" }} locale={locale} t={t} />
    </>
  );
}
