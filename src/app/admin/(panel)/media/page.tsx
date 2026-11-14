import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { t } from "../../_lib/strings";
import { getMediaWithUsage } from "../../_lib/queries";
import { PageHeader } from "../../_components/ui";
import { MediaLibrary } from "../../_components/MediaLibrary";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.media.title };

export default async function MediaPage() {
  await requireAdmin();
  const items = await getMediaWithUsage();
  return (
    <>
      <PageHeader title={t.media.title} description={t.media.intro} />
      <MediaLibrary items={items} />
    </>
  );
}
