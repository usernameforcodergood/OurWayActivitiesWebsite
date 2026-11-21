/** Payment tracking — shared by server actions, queries and client components. */

export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "iris", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "partial", "deposit_paid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** List filter: money still owed on committed requests, or money to give back. */
export const PAYMENT_FILTERS = ["open", "refund"] as const;
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number];

export type PaymentRow = {
  id: number;
  kind: "payment" | "refund";
  amount_eur: string | number;
  paid_on: string;
  method: PaymentMethod;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

/** Money columns of booking_overview (migration 0012). Numeric columns arrive as strings. */
export type BookingMoney = {
  amount_due_eur: string | number | null;
  deposit_due_eur: string | number | null;
  expected_total_eur: string | number | null;
  expected_deposit_eur: string | number | null;
  paid_eur: string | number;
  refunded_eur: string | number;
  net_paid_eur: string | number;
  balance_eur: string | number | null;
  payment_status: PaymentStatus;
  payment_open: boolean;
  refund_due: boolean;
};

/** Numeric from PostgREST (string) → number; null stays null. */
export function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Number → the value shown in an amount input ("1234.5" → "1234,50"). */
export function toInput(v: string | number | null | undefined): string {
  const n = num(v);
  return n === null ? "" : n.toFixed(2).replace(".", ",");
}
