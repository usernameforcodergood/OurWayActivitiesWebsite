import { t } from "../_lib/strings";
import type { EmailRow, HistoryRow } from "../_lib/booking-queries";
import { ResendEmailButton } from "./BookingActions";
import { Card, formatDate } from "./ui";

const B = t.bookings;

function statusLabel(s: string | null): string {
  if (!s) return "—";
  return (B.statuses as Record<string, string>)[s] ?? (t.privateRequests.statuses as Record<string, string>)[s] ?? s;
}

export function HistoryCard({ history }: { history: HistoryRow[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">{B.history}</h2>
      <ol className="space-y-3 border-l-2 border-ink/10 pl-4">
        {history.map((h) => (
          <li key={h.id} className="text-sm">
            <p>
              {h.from_status ? (
                <>
                  {statusLabel(h.from_status)} → <strong>{statusLabel(h.to_status)}</strong>
                </>
              ) : (
                <strong>{statusLabel(h.to_status)}</strong>
              )}
            </p>
            <p className="text-xs text-bark">
              {formatDate(h.created_at, true)} · {h.changed_by ? B.historyAdmin : B.historySystem}
            </p>
            {h.note && <p className="mt-1 whitespace-pre-wrap rounded bg-stone/50 p-2 text-xs">{h.note}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function EmailCard({ emails, resendFor }: { emails: EmailRow[]; resendFor?: string }) {
  const failed = emails.some((e) => e.status !== "sent" && !e.kind.startsWith("admin_"));
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{B.emails}</h2>
        {resendFor && failed && <ResendEmailButton id={resendFor} />}
      </div>
      {emails.length === 0 ? (
        <p className="text-sm text-bark">{B.emailsEmpty}</p>
      ) : (
        <ul className="divide-y divide-ink/8 text-sm">
          {emails.map((e) => (
            <li key={e.id} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{(B.emailKinds as Record<string, string>)[e.kind] ?? e.kind}</span>
                <span
                  className={
                    e.status === "sent"
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900"
                      : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900"
                  }
                >
                  {B.emailStatus[e.status]}
                </span>
              </div>
              <p className="text-xs text-bark">
                {e.recipient} · {formatDate(e.created_at, true)}
              </p>
              {e.error && <p className="mt-1 break-words text-xs text-red-800">{e.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
