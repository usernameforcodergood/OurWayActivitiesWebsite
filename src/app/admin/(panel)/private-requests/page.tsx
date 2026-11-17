import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { PRIVATE_STATUSES } from "@/lib/bookings/validation";
import { cn } from "@/lib/utils";
import { fmt, t } from "../../_lib/strings";
import { listPrivateRequests, parsePrivateParams, type PrivateListParams } from "../../_lib/booking-queries";
import { EmptyState, PageHeader, PrivateStatusBadge, formatDate, formatDay } from "../../_components/ui";

export const instant = false;
export const metadata: Metadata = { title: t.privateRequests.title };

function href(p: Partial<PrivateListParams>) {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `/admin/private-requests?${s}` : "/admin/private-requests";
}

export default async function PrivateRequestsPage({ searchParams }: PageProps<"/admin/private-requests">) {
  await requireAdmin();
  const p = parsePrivateParams(await searchParams);
  const { rows, total, pages } = await listPrivateRequests(p);
  const P = t.privateRequests;
  const filtered = Boolean(p.q) || p.status !== "all";
  const tabs: Array<["all" | (typeof PRIVATE_STATUSES)[number], string]> = [["all", t.common.all], ...PRIVATE_STATUSES.map((s) => [s, P.statuses[s]] as [typeof s, string])];

  return (
    <>
      <PageHeader title={P.title} description={P.intro} />
      <div className="mb-5 space-y-3">
        <nav aria-label={P.statusLabel} className="flex flex-wrap gap-1">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={href({ ...p, status: key, page: 1 })}
              aria-current={p.status === key ? "true" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium",
                p.status === key ? "bg-forest text-bone" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-stone/60",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/private-requests" className="flex flex-col gap-2 sm:flex-row">
          {p.status !== "all" && <input type="hidden" name="status" value={p.status} />}
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bark" />
            <label htmlFor="pq" className="sr-only">
              {t.common.search}
            </label>
            <input id="pq" name="q" type="search" defaultValue={p.q} placeholder={P.searchPlaceholder} className="admin-input pl-9" />
          </div>
          <button type="submit" className="min-h-10 rounded-lg bg-forest px-4 text-sm font-semibold text-bone hover:bg-moss">
            {t.common.search}
          </button>
        </form>
        <p className="text-xs text-bark">{fmt(t.common.results, { count: total })}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={filtered ? P.emptyFiltered : P.empty} />
      ) : (
        <ul className="admin-card divide-y divide-ink/8">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/private-requests/${r.id}`} className="flex flex-col gap-2 p-4 hover:bg-stone/30 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-lagoon">{r.reference}</span>
                    <span className="font-semibold">
                      {r.first_name} {r.last_name}
                    </span>
                    <PrivateStatusBadge status={r.status} />
                  </span>
                  <span className="mt-1 block text-xs text-bark">
                    {fmt(P.people, { count: r.participants })}
                    {r.destination && ` · ${r.destination}`}
                    {r.destination_flexible && ` (${P.flexible})`}
                    {r.date_from && ` · ${formatDay(r.date_from)}${r.date_to ? ` – ${formatDay(r.date_to)}` : ""}`}
                    {r.dates_flexible && ` · ${P.dates}: ${P.flexible}`}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-bark">{formatDate(r.created_at, true)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="pagination" className="mt-6 flex items-center justify-between gap-3">
          {p.page > 1 ? (
            <Link href={href({ ...p, page: p.page - 1 })} className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink/10">
              ← {t.common.prev}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-bark">{fmt(t.common.page, { page: p.page, pages })}</span>
          {p.page < pages ? (
            <Link href={href({ ...p, page: p.page + 1 })} className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink/10">
              {t.common.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
