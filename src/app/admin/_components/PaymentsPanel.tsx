"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, Plus, Undo2 } from "lucide-react";
import { recordPayment, setBookingAmounts, voidPayment } from "../_actions/payments";
import { errorMessage, fmt, t } from "../_lib/strings";
import { PAYMENT_METHODS, num, toInput, type BookingMoney, type PaymentMethod, type PaymentRow } from "../_lib/payments";
import { athensToday } from "@/lib/bookings/validation";
import { useToast } from "./Toast";
import { Btn, Card, PaymentStatusBadge, formatDate, formatDay, formatEurAdmin } from "./ui";

const P = t.payments;

/** Error code → message; refundExceeds carries the refundable amount. */
function message(error: string, amount?: number) {
  if (error === "refundExceeds") return fmt(P.refundExceeds, { amount: formatEurAdmin(amount ?? 0) });
  return errorMessage(error) ?? t.common.error;
}

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

/**
 * Money for one request: what is expected (agreed total / deposit) and what was
 * actually received (a list of payments and refunds). Totals come from the
 * database view; nothing here adds up money on its own.
 */
export function PaymentsPanel({ bookingId, kind, money, payments }: { bookingId: string; kind: "booking" | "interest"; money: BookingMoney; payments: PaymentRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const [pending, start] = useTransition();

  const [movement, setMovement] = useState<"payment" | "refund" | null>(null);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [note, setNote] = useState("");
  const movementRef = useDialog(movement !== null);

  const [editing, setEditing] = useState(false);
  const [amountDue, setAmountDue] = useState(toInput(money.amount_due_eur));
  const [depositDue, setDepositDue] = useState(toInput(money.deposit_due_eur));

  const [voiding, setVoiding] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState("");
  const voidRef = useDialog(voiding !== null);

  const expected = num(money.expected_total_eur);
  const deposit = num(money.expected_deposit_eur);
  const paid = num(money.paid_eur) ?? 0;
  const refunded = num(money.refunded_eur) ?? 0;
  const net = num(money.net_paid_eur) ?? 0;
  const balance = num(money.balance_eur);

  const openMovement = (k: "payment" | "refund") => {
    setAmount("");
    setPaidOn(athensToday());
    setMethod("bank_transfer");
    setNote("");
    setMovement(k);
  };

  const saveMovement = () => {
    if (!movement) return;
    start(async () => {
      const res = await recordPayment({ bookingId, kind: movement, amount, paidOn, method, note });
      if (!res.ok) {
        toast("error", message(res.error, res.amount));
        return;
      }
      toast("success", movement === "refund" ? P.refundRecorded : P.paymentRecorded);
      setMovement(null);
      router.refresh();
    });
  };

  const saveAmounts = () =>
    start(async () => {
      const res = await setBookingAmounts({ bookingId, amountDue, depositDue });
      if (!res.ok) {
        toast("error", message(res.error));
        return;
      }
      toast("success", P.amountsSaved);
      setEditing(false);
      router.refresh();
    });

  const saveVoid = () => {
    if (!voiding) return;
    start(async () => {
      const res = await voidPayment({ paymentId: voiding.id, reason });
      if (!res.ok) {
        toast("error", message(res.error));
        return;
      }
      toast("success", P.voidDone);
      setVoiding(null);
      setReason("");
      router.refresh();
    });
  };

  const summary: Array<[string, React.ReactNode]> = [
    [
      P.expectedTotal,
      <>
        <strong>{expected === null ? P.notSet : formatEurAdmin(expected)}</strong>
        {expected !== null && <span className="ml-2 text-xs text-bark">({money.amount_due_eur != null ? P.sourceAgreed : P.sourceDefaultTotal})</span>}
      </>,
    ],
    [
      P.expectedDeposit,
      <>
        {deposit === null ? P.notSet : formatEurAdmin(deposit)}
        {deposit !== null && <span className="ml-2 text-xs text-bark">({money.deposit_due_eur != null ? P.sourceAgreed : P.sourceDefaultDeposit})</span>}
      </>,
    ],
    [P.paid, formatEurAdmin(paid)],
    ...(refunded > 0 ? ([[P.refunded, `− ${formatEurAdmin(refunded)}`]] as Array<[string, React.ReactNode]>) : []),
    ...(refunded > 0 ? ([[P.netPaid, formatEurAdmin(net)]] as Array<[string, React.ReactNode]>) : []),
    balance !== null && balance < 0
      ? [P.overpaid, <strong key="b" className="text-amber-800">{formatEurAdmin(-balance)}</strong>]
      : [P.balance, <strong key="b">{balance === null ? "—" : formatEurAdmin(balance)}</strong>],
  ];

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{P.title}</h2>
        <PaymentStatusBadge status={money.payment_status} />
      </div>
      <p className="mb-4 text-xs text-bark">{P.hint}</p>

      {money.refund_due && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{P.refundDue}</p>}

      <dl className="divide-y divide-ink/8 text-sm">
        {summary.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[11rem_1fr] gap-3 py-2.5">
            <dt className="text-bark">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {editing ? (
        <form
          className="mt-4 space-y-3 rounded-xl bg-stone/40 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveAmounts();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-due`} className="block text-sm font-semibold">
                {P.amountDueLabel}
              </label>
              <input id={`${uid}-due`} inputMode="decimal" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} className="admin-input mt-1.5" />
            </div>
            <div>
              <label htmlFor={`${uid}-dep`} className="block text-sm font-semibold">
                {P.depositDueLabel}
              </label>
              <input id={`${uid}-dep`} inputMode="decimal" value={depositDue} onChange={(e) => setDepositDue(e.target.value)} className="admin-input mt-1.5" />
            </div>
          </div>
          <p className="text-xs text-bark">{kind === "interest" ? P.amountsHintInquiry : P.amountsHint}</p>
          <div className="flex justify-end gap-2">
            <Btn
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setAmountDue(toInput(money.amount_due_eur));
                setDepositDue(toInput(money.deposit_due_eur));
                setEditing(false);
              }}
            >
              {t.common.cancel}
            </Btn>
            <Btn type="submit" disabled={pending}>
              {pending ? t.common.saving : t.common.save}
            </Btn>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn variant="publish" onClick={() => openMovement("payment")} disabled={pending}>
            <Plus aria-hidden className="size-4" /> {P.addPayment}
          </Btn>
          <Btn variant="secondary" onClick={() => openMovement("refund")} disabled={pending || net <= 0}>
            <Undo2 aria-hidden className="size-4" /> {P.addRefund}
          </Btn>
          <Btn variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
            <Pencil aria-hidden className="size-4" /> {P.editAmounts}
          </Btn>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">{P.movements}</h3>
      {payments.length === 0 ? (
        <p className="mt-2 text-sm text-bark">{P.movementsEmpty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/8 text-sm">
          {payments.map((p) => {
            const voided = p.voided_at !== null;
            return (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className={voided ? "text-bark line-through" : undefined}>
                  <span className={p.kind === "refund" ? "font-semibold text-red-800" : "font-semibold text-emerald-800"}>
                    {p.kind === "refund" ? `− ${formatEurAdmin(p.amount_eur)}` : `+ ${formatEurAdmin(p.amount_eur)}`}
                  </span>
                  <span className="ml-2">
                    {p.kind === "refund" ? P.kindRefund : P.kindPayment} · {P.methods[p.method]} · {formatDay(p.paid_on)}
                  </span>
                  {p.note && <span className="block text-xs text-bark">{p.note}</span>}
                </div>
                <div className="text-right text-xs text-bark">
                  {voided ? (
                    <span className="block max-w-64 text-amber-900">{fmt(P.voidedOn, { date: formatDate(p.voided_at, true), reason: p.void_reason ?? "" })}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReason("");
                        setVoiding(p);
                      }}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-stone/60 hover:text-ink"
                    >
                      <Ban aria-hidden className="size-3.5" /> {P.void}
                    </button>
                  )}
                  <span className="block">{formatDate(p.created_at, true)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <dialog ref={movementRef} onClose={() => setMovement(null)} aria-labelledby={`${uid}-mv-title`} className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl">
        {movement && (
          <form
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveMovement();
            }}
          >
            <h2 id={`${uid}-mv-title`} className="text-lg font-semibold">
              {movement === "refund" ? P.addRefund : P.addPayment}
            </h2>
            {movement === "refund" && <p className="mt-1 text-sm text-bark">{fmt(P.refundMax, { amount: formatEurAdmin(net) })}</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-amount`} className="block text-sm font-semibold">
                  {P.amount}
                </label>
                <input id={`${uid}-amount`} inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className="admin-input mt-1.5" autoFocus />
              </div>
              <div>
                <label htmlFor={`${uid}-date`} className="block text-sm font-semibold">
                  {P.paidOn}
                </label>
                <input id={`${uid}-date`} type="date" required max={athensToday()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="admin-input mt-1.5" />
              </div>
            </div>
            <label htmlFor={`${uid}-method`} className="mt-4 block text-sm font-semibold">
              {P.method}
            </label>
            <select id={`${uid}-method`} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="admin-input mt-1.5">
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {P.methods[m]}
                </option>
              ))}
            </select>
            <label htmlFor={`${uid}-note`} className="mt-4 block text-sm font-semibold">
              {P.note}
            </label>
            <input id={`${uid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={P.notePlaceholder} className="admin-input mt-1.5" />
            <div className="mt-6 flex justify-end gap-2">
              <Btn type="button" variant="secondary" onClick={() => setMovement(null)} disabled={pending}>
                {t.common.cancel}
              </Btn>
              <Btn type="submit" variant={movement === "refund" ? "danger" : "publish"} disabled={pending || !amount.trim()}>
                {pending ? t.common.saving : movement === "refund" ? P.addRefund : P.addPayment}
              </Btn>
            </div>
          </form>
        )}
      </dialog>

      <dialog ref={voidRef} onClose={() => setVoiding(null)} aria-labelledby={`${uid}-void-title`} className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl">
        {voiding && (
          <form
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveVoid();
            }}
          >
            <h2 id={`${uid}-void-title`} className="text-lg font-semibold">
              {P.voidTitle}
            </h2>
            <p className="mt-2 text-sm text-bark">
              {fmt(P.voidBody, { kind: voiding.kind === "refund" ? P.kindRefund.toLowerCase() : P.kindPayment.toLowerCase(), amount: formatEurAdmin(voiding.amount_eur) })}
            </p>
            <label htmlFor={`${uid}-reason`} className="mt-5 block text-sm font-semibold">
              {P.voidReasonLabel}
            </label>
            <input id={`${uid}-reason`} required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="admin-input mt-1.5" autoFocus />
            <div className="mt-6 flex justify-end gap-2">
              <Btn type="button" variant="secondary" onClick={() => setVoiding(null)} disabled={pending}>
                {t.common.cancel}
              </Btn>
              <Btn type="submit" variant="danger" disabled={pending || !reason.trim()}>
                {pending ? t.common.saving : P.void}
              </Btn>
            </div>
          </form>
        )}
      </dialog>
    </Card>
  );
}
