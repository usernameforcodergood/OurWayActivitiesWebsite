import Link from "next/link";
import { Search } from "lucide-react";
import { t, fmt } from "../_lib/strings";
import { cn } from "@/lib/utils";

export type ListParams = { q: string; status: "all" | "draft" | "published"; sort: "updated" | "created" | "title"; page: number };

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = one("status");
  const sort = one("sort");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").slice(0, 100),
    status: status === "draft" || status === "published" ? status : "all",
    sort: sort === "created" || sort === "title" ? sort : "updated",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function href(base: string, p: Partial<ListParams>) {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.sort && p.sort !== "updated") sp.set("sort", p.sort);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/** GET form: works without JavaScript and keeps filters in the URL. */
export function ListToolbar({ base, params, total }: { base: string; params: ListParams; total: number }) {
  const tabs: Array<[ListParams["status"], string]> = [
    ["all", t.common.all],
    ["published", t.common.published],
    ["draft", t.common.draft],
  ];
  return (
    <div className="mb-5 space-y-3">
      <nav aria-label={t.common.all} className="flex flex-wrap gap-1">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={href(base, { ...params, status: key, page: 1 })}
            aria-current={params.status === key ? "true" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium",
              params.status === key ? "bg-forest text-bone" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-stone/60",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form method="get" action={base} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {params.status !== "all" && <input type="hidden" name="status" value={params.status} />}
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bark" />
          <label htmlFor="list-q" className="sr-only">
            {t.common.search}
          </label>
          <input
            id="list-q"
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder={t.common.searchPlaceholder}
            className="admin-input pl-9"
          />
        </div>
        <label htmlFor="list-sort" className="sr-only">
          {t.common.sortBy}
        </label>
        <select id="list-sort" name="sort" defaultValue={params.sort} className="admin-input sm:w-56">
          <option value="updated">{t.common.sortUpdated}</option>
          <option value="created">{t.common.sortCreated}</option>
          <option value="title">{t.common.sortTitle}</option>
        </select>
        <button type="submit" className="min-h-10 rounded-lg bg-forest px-4 text-sm font-semibold text-bone hover:bg-moss">
          {t.common.search}
        </button>
      </form>
      <p className="text-xs text-bark">{fmt(t.common.results, { count: total })}</p>
    </div>
  );
}

export function Pagination({ base, params, pages }: { base: string; params: ListParams; pages: number }) {
  if (pages <= 1) return null;
  const linkCls = "rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink/10 hover:bg-stone/60";
  return (
    <nav aria-label="pagination" className="mt-6 flex items-center justify-between gap-3">
      {params.page > 1 ? (
        <Link href={href(base, { ...params, page: params.page - 1 })} className={linkCls}>
          ← {t.common.prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-bark">{fmt(t.common.page, { page: params.page, pages })}</span>
      {params.page < pages ? (
        <Link href={href(base, { ...params, page: params.page + 1 })} className={linkCls}>
          {t.common.next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Escapes characters that have meaning in PostgREST `or()` filters. */
export function ilikePattern(q: string): string {
  return `%${q.replace(/[%_\\,()*"]/g, " ").trim()}%`;
}
