import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarDays, ImageIcon, ImageOff, Plus, ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { mediaUrl } from "@/lib/supabase/config";
import { availableLocales } from "@/lib/cms/mappers";
import { t } from "../../_lib/strings";
import { listJourneys } from "../../_lib/journey-queries";
import { ListToolbar, Pagination, parseListParams } from "../../_components/ListToolbar";
import { BtnLink, EmptyState, PageHeader, StatusBadge, formatRun } from "../../_components/ui";
import { RowActions } from "../../_components/RowActions";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.journeys.title };

export default async function JourneysAdminPage({ searchParams }: PageProps<"/admin/journeys">) {
  await requireAdmin();
  await connection();
  const params = parseListParams(await searchParams);
  const { rows, total, pages, missing } = await listJourneys(params);
  const filtered = Boolean(params.q) || params.status !== "all";

  return (
    <>
      <PageHeader
        title={t.journeys.title}
        description={t.journeys.intro}
        actions={
          !missing && (
            <BtnLink href="/admin/journeys/new">
              <Plus aria-hidden className="size-4" />
              {t.journeys.new}
            </BtnLink>
          )
        }
      />
      {missing ? (
        <EmptyState title={t.journeys.notMigrated} />
      ) : (
        <>
          <ListToolbar base="/admin/journeys" params={params} total={total} />
          {rows.length === 0 ? (
            <EmptyState
              title={filtered ? t.journeys.emptyFiltered : t.journeys.empty}
              action={!filtered && <BtnLink href="/admin/journeys/new">{t.journeys.new}</BtnLink>}
            />
          ) : (
            <ul className="admin-card divide-y divide-ink/8">
              {rows.map((r) => {
                const langs = availableLocales(r);
                const title = r.title_el || r.title_en || t.common.untitled;
                const cover = r.cover ?? r.images?.slice().sort((a, b) => a.position - b.position)[0]?.media ?? null;
                const excursion = r.excursion?.title_el || r.excursion?.title_en;
                return (
                  <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <Link href={`/admin/journeys/${r.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                      <span className="relative block size-16 shrink-0 overflow-hidden rounded-lg bg-stone">
                        {cover ? (
                          <Image src={mediaUrl(cover.path)} alt="" fill sizes="64px" className="object-cover" />
                        ) : (
                          <ImageOff aria-hidden className="absolute inset-0 m-auto size-5 text-bark/50" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-bark">
                          <StatusBadge status={r.status} />
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays aria-hidden className="size-3.5" />
                            {formatRun(r.occurred_on, r.occurred_until)}
                          </span>
                          {excursion && <span>· {excursion}</span>}
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon aria-hidden className="size-3.5" />
                            {r.images?.length ?? 0}
                          </span>
                          {!r.photo_consent_confirmed && (
                            <span className="inline-flex items-center gap-1 text-amber-800">
                              <ShieldAlert aria-hidden className="size-3.5" />
                              {t.journeys.consentMissing}
                            </span>
                          )}
                          <span>
                            {(["el", "en"] as const).map((l) => (
                              <span key={l} className={langs.includes(l) ? "mr-1 font-semibold text-emerald-700" : "mr-1 text-bark/50 line-through"}>
                                {l.toUpperCase()}
                              </span>
                            ))}
                          </span>
                        </span>
                      </span>
                    </Link>
                    <RowActions
                      kind="journey"
                      id={r.id}
                      status={r.status}
                      name={title}
                      editHref={`/admin/journeys/${r.id}`}
                      publicHref={r.status === "published" && langs.length ? `/${langs[0]}/journeys/${r.slug}` : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination base="/admin/journeys" params={params} pages={pages} />
        </>
      )}
    </>
  );
}
