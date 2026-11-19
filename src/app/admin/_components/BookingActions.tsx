"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, Check, CheckCheck, Mail, X } from "lucide-react";
import { extendBookingHold, resendBookingEmail, setBookingStatus } from "../_actions/bookings";
import { errorMessage, fmt, t } from "../_lib/strings";
import { useToast } from "./Toast";
import { Btn, type BtnVariant } from "./ui";

type Target = "confirmed" | "rejected" | "cancelled" | "completed";

const B = t.bookings;
const DIALOG: Record<Target, { title: string; body: string; label: string; variant: BtnVariant; email: boolean }> = {
  confirmed: { title: B.confirmTitle, body: B.confirmBody, label: B.confirm, variant: "publish", email: true },
  rejected: { title: B.rejectTitle, body: B.rejectBody, label: B.reject, variant: "danger", email: true },
  cancelled: { title: B.cancelTitle, body: B.cancelBody, label: B.cancel, variant: "danger", email: true },
  completed: { title: B.completeTitle, body: B.completeBody, label: B.complete, variant: "primary", email: false },
};

function emailToast(toast: ReturnType<typeof useToast>, email: string) {
  if (email === "sent") toast("success", `${B.statusChanged} ${B.emailSentOk}`);
  else if (email === "failed") toast("error", B.emailFailed);
  else if (email === "not_configured") toast("error", B.emailNotConfigured);
  else toast("success", B.statusChanged);
}

/** Status changes with an explicit confirmation step, optional customer note, and honest email feedback. */
export function BookingActions({
  id,
  reference,
  participants,
  status,
  holdExpired,
  canExtend,
}: {
  id: string;
  reference: string;
  participants: number;
  status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed";
  holdExpired: boolean;
  canExtend: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [target, setTarget] = useState<Target | null>(null);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  const options: Target[] = status === "pending" ? ["confirmed", "rejected", "cancelled"] : status === "confirmed" ? ["cancelled", "completed"] : [];
  const icon = { confirmed: Check, rejected: X, cancelled: Ban, completed: CheckCheck } as const;

  const run = () => {
    if (!target) return;
    start(async () => {
      const res = await setBookingStatus({ id, status: target, note, notify: DIALOG[target].email && notify });
      if (!res.ok) {
        toast("error", res.error === "capacity" ? fmt(B.capacity, { count: res.count ?? 0 }) : (errorMessage(res.error) ?? t.common.error));
        return;
      }
      emailToast(toast, res.data.email);
      setTarget(null);
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {options.length === 0 && <p className="text-sm text-bark">—</p>}
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const Icon = icon[o];
          return (
            <Btn key={o} variant={o === "confirmed" ? "publish" : o === "completed" ? "primary" : "secondary"} onClick={() => setTarget(o)} disabled={pending}>
              <Icon aria-hidden className="size-4" />
              {DIALOG[o].label}
            </Btn>
          );
        })}
        {status === "pending" && canExtend && (
          <Btn
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await extendBookingHold(id);
                if (!res.ok) toast("error", res.error === "capacity" ? fmt(B.capacity, { count: res.count ?? 0 }) : (errorMessage(res.error) ?? t.common.error));
                else {
                  toast("success", B.holdExtended);
                  router.refresh();
                }
              })
            }
          >
            <CalendarClock aria-hidden className="size-4" />
            {B.extendHold}
          </Btn>
        )}
        {holdExpired && status === "pending" && <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">{B.holdExpired}</p>}
      </div>

      <dialog ref={ref} onClose={() => setTarget(null)} aria-labelledby={`${uid}-title`} className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl">
        {target && (
          <div className="p-6">
            <h2 id={`${uid}-title`} className="text-lg font-semibold">
              {DIALOG[target].title}
            </h2>
            <p className="mt-2 text-sm text-bark">{fmt(DIALOG[target].body, { ref: reference, people: participants })}</p>
            <label htmlFor={`${uid}-note`} className="mt-5 block text-sm font-semibold">
              {B.customerNote}
            </label>
            <textarea id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className="admin-input mt-1.5" />
            <p className="mt-1 text-xs text-bark">{B.customerNoteHint}</p>
            {DIALOG[target].email && (
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-emerald-700" />
                {B.notifyCustomer}
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setTarget(null)} disabled={pending} autoFocus>
                {t.common.cancel}
              </Btn>
              <Btn variant={DIALOG[target].variant} onClick={run} disabled={pending}>
                {pending ? t.common.saving : DIALOG[target].label}
              </Btn>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

export function ResendEmailButton({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Btn
      variant="secondary"
      className="min-h-8 px-3 py-1 text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resendBookingEmail(id);
          if (!res.ok) toast("error", errorMessage(res.error) ?? t.common.error);
          else if (res.data.email === "sent") toast("success", B.resent);
          else toast("error", res.data.email === "not_configured" ? B.emailNotConfigured : B.resendFailed);
          router.refresh();
        })
      }
    >
      <Mail aria-hidden className="size-3.5" />
      {B.resend}
    </Btn>
  );
}
