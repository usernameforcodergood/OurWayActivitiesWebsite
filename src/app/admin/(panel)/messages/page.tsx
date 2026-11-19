import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fmt, t } from "../../_lib/strings";
import { MESSAGE_STATUSES, listMessages, parseMessageParams, type MessageListParams } from "../../_lib/message-queries";
import { EmptyState, PageHeader, formatDate, formatDay } from "../../_components/ui";
import { MessageStatusSelect } from "../../_components/MessageStatusSelect";

export const instant = false;
export const metadata: Metadata = { title: t.messages.title };

function href(p: Partial<MessageListParams>) {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `/admin/messages?${s}` : "/admin/messages";
}

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireAdmin();
  const p = parseMessageParams(await searchParams);
  const { rows, total, pages, unavailable } = await listMessages(p);
  const M = t.messages;
  const filtered = Boolean(p.q) || p.status !== "all";
  const tabs: Array<["all" | (typeof MESSAGE_STATUSES)[number], string]> = [["all", t.common.all], ...MESSAGE_STATUSES.map((s): ["all" | (typeof MESSAGE_STATUSES)[number], string] => [s, M.statuses[s]])];

  return (
    <>
      <PageHeader title={M.title} description={M.intro} />
      <div className="mb-5 space-y-3">
        <nav aria-label={M.status} className="flex flex-wrap gap-1">
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
        <form method="get" action="/admin/messages" className="flex gap-2">
          {p.status !== "all" && <input type="hidden" name="status" value={p.status} />}
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bark" />
            <label htmlFor="mq" className="sr-only">
              {t.common.search}
            </label>
            <input id="mq" name="q" type="search" defaultValue={p.q} placeholder={M.searchPlaceholder} className="admin-input pl-9" />
          </div>
          <button type="submit" className="min-h-10 rounded-lg bg-forest px-4 text-sm font-semibold text-bone hover:bg-moss">
            {t.bookings.filter}
          </button>
          {filtered && (
            <Link href="/admin/messages" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-bark ring-1 ring-ink/10 hover:bg-stone/60">
              {t.bookings.clear}
            </Link>
          )}
        </form>
        <p className="text-xs text-bark">{fmt(t.common.results, { count: total })}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={unavailable ? t.common.error : filtered ? M.emptyFiltered : M.empty} />
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-bark">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{M.reference}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{M.sender}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{M.interest}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{M.message}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{M.status}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{M.submitted}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-stone/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold">{r.reference}</td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{r.name}</span>
                    <a href={`mailto:${r.email}`} className="block text-xs text-bark hover:text-ink">
                      {r.email}
                    </a>
                    {r.phone && (
                      <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="block text-xs text-bark hover:text-ink">
                        {r.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{r.interest || "—"}</span>
                    {(r.preferred_date || r.participants) && (
                      <span className="block text-xs text-bark">
                        {[r.preferred_date ? `${M.date}: ${formatDay(r.preferred_date)}` : null, r.participants ? `${M.participants}: ${r.participants}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <p className="whitespace-pre-wrap break-words text-sm">{r.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <MessageStatusSelect id={r.id} reference={r.reference} status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-bark">{formatDate(r.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="pagination" className="mt-6 flex items-center justify-between gap-3">
          {p.page > 1 ? (
            <Link href={href({ ...p, page: p.page - 1 })} className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink/10 hover:bg-stone/60">
              ← {t.common.prev}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-bark">{fmt(t.common.page, { page: p.page, pages })}</span>
          {p.page < pages ? (
            <Link href={href({ ...p, page: p.page + 1 })} className="rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-ink/10 hover:bg-stone/60">
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
