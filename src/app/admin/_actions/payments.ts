"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/cms/schemas";
import { athensToday } from "@/lib/bookings/validation";
import { PAYMENT_METHODS } from "../_lib/payments";

/**
 * Payment tracking (recorded by admins; no money moves through the website).
 * Every write goes through a database function that checks the admin, locks
 * the request and validates the amounts again — these checks are the first
 * line, not the only one.
 */

const uuid = z.uuid();

/** "120", "120.5", "1.234,50" → 1234.5 (max two decimals). Empty → null. */
function euro(allowEmpty: boolean) {
  return z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (!raw) {
        if (allowEmpty) return null;
        ctx.addIssue({ code: "custom", message: "paymentAmount" });
        return z.NEVER;
      }
      // Greek format: "." thousands, "," decimals. A lone "." is a decimal point.
      const v = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
      if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "paymentAmount" });
        return z.NEVER;
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n > 1_000_000) {
        ctx.addIssue({ code: "custom", message: "paymentAmount" });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    });
}

function dbError(message: string | undefined): { error: string; amount?: number } {
  const m = message ?? "";
  const refund = /^refund_exceeds:([\d.]+)$/.exec(m);
  if (refund) return { error: "refundExceeds", amount: Number(refund[1]) };
  const known: Record<string, string> = {
    payment_amount: "paymentAmount",
    payment_date: "paymentDate",
    payment_method: "generic",
    payment_kind: "generic",
    deposit_above_total: "depositAboveTotal",
    void_reason: "voidReason",
    already_voided: "alreadyVoided",
    void_breaks_refunds: "voidBreaksRefunds",
  };
  return { error: known[m] ?? "generic" };
}

const paymentInput = z.object({
  bookingId: uuid,
  kind: z.enum(["payment", "refund"]),
  amount: euro(false).refine((n) => n !== null && n > 0, "paymentAmount"),
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paymentDate")
    .refine((d) => d >= "2020-01-01" && d <= athensToday() && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "paymentDate"),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(500, "tooLong"),
});

export async function recordPayment(input: z.input<typeof paymentInput>): Promise<ActionResult & { amount?: number }> {
  await requireAdmin();
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };
  const { bookingId, kind, amount, paidOn, method, note } = parsed.data;
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_record_payment", {
    p_booking_id: bookingId,
    p_kind: kind,
    p_amount: amount,
    p_paid_on: paidOn,
    p_method: method,
    p_note: note || null,
  });
  if (error) {
    const e = dbError(error.message);
    if (e.error === "generic") console.error("[admin] record payment:", error.message);
    return { ok: false, ...e };
  }
  return { ok: true };
}

const voidInput = z.object({ paymentId: z.number().int().positive(), reason: z.string().trim().min(1, "voidReason").max(500, "tooLong") });

export async function voidPayment(input: z.input<typeof voidInput>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = voidInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_void_payment", { p_payment_id: parsed.data.paymentId, p_reason: parsed.data.reason });
  if (error) {
    const e = dbError(error.message);
    if (e.error === "generic") console.error("[admin] void payment:", error.message);
    return { ok: false, ...e };
  }
  return { ok: true };
}

const amountsInput = z
  .object({ bookingId: uuid, amountDue: euro(true), depositDue: euro(true) })
  .refine((v) => v.amountDue === null || v.depositDue === null || v.depositDue <= v.amountDue, { message: "depositAboveTotal" });

/** Agreed total / deposit. An empty field means "use the default" (price snapshot / excursion deposit). */
export async function setBookingAmounts(input: z.input<typeof amountsInput>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = amountsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_set_booking_amounts", {
    p_booking_id: parsed.data.bookingId,
    p_amount_due: parsed.data.amountDue,
    p_deposit_due: parsed.data.depositDue,
  });
  if (error) {
    const e = dbError(error.message);
    if (e.error === "generic") console.error("[admin] booking amounts:", error.message);
    return { ok: false, ...e };
  }
  return { ok: true };
}
