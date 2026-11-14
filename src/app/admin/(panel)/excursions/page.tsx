import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, Plus, Star } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { mediaUrl } from "@/lib/supabase/config";
import { availableLocales } from "@/lib/cms/mappers";
import { t } from "../../_lib/strings";
import { listExcursions } from "../../_lib/queries";
import { ListToolbar, Pagination, parseListParams } from "../../_components/ListToolbar";
import { BtnLink, EmptyState, PageHeader, StatusBadge, formatDate } from "../../_components/ui";
import { RowActions } from "../../_components/RowActions";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.excursions.title };

export default async function ExcursionsPage({ searchParams }: PageProps<"/admin/excursions">) {
  await requireAdmin();
  const params = parseListParams(await searchParams);
  const { rows, total, pages } = await listExcursions(params);
  const filtered = Boolean(params.q) || params.status !== "all";

  return (
    <>
      <PageHeader
        title={t.excursions.title}
        actions={
          <BtnLink href="/admin/excursions/new">
            <Plus aria-hidden className="size-4" />
            {t.excursions.new}
          </BtnLink>
        }
      />
      <ListToolbar base="/admin/excursions" params={params} total={total} />

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? t.excursions.emptyFiltered : t.excursions.empty}
          action={!filtered && <BtnLink href="/admin/excursions/new">{t.excursions.new}</BtnLink>}
        />
      ) : (
        <ul className="admin-card divide-y divide-ink/8">
          {rows.map((r) => {
            const langs = availableLocales(r);
            const title = r.title_el || r.title_en || t.common.untitled;
            return (
              <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <Link href={`/admin/excursions/${r.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg">
                  <span className="relative block size-16 shrink-0 overflow-hidden rounded-lg bg-stone">
                    {r.cover ? (
                      <Image src={mediaUrl(r.cover.path)} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <ImageOff aria-hidden className="absolute inset-0 m-auto size-5 text-bark/50" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{title}</span>
                      {r.featured && <Star aria-label={t.common.featured} className="size-4 shrink-0 fill-amber-400 text-amber-500" />}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-bark">
                      <StatusBadge status={r.status} />
                      <span className="font-mono">/{r.slug}</span>
                      <span aria-label="languages">
                        {(["el", "en"] as const).map((l) => (
                          <span key={l} className={langs.includes(l) ? "mr-1 font-semibold text-emerald-700" : "mr-1 text-bark/50 line-through"}>
                            {l.toUpperCase()}
                          </span>
                        ))}
                      </span>
                      <span>· {formatDate(r.updated_at, true)}</span>
                    </span>
                  </span>
                </Link>
                <RowActions
                  kind="excursion"
                  id={r.id}
                  status={r.status}
                  name={title}
                  editHref={`/admin/excursions/${r.id}`}
                  publicHref={r.status === "published" && langs.length ? `/${langs[0]}/activities/${r.slug}` : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
      <Pagination base="/admin/excursions" params={params} pages={pages} />
    </>
  );
}
