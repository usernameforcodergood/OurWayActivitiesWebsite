"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { TAGS } from "@/lib/cms/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site";
import type { ActionResult } from "@/lib/cms/schemas";
import { renderCustomerBookingEmail, type BookingEmailData, type CustomerBookingEmail } from "@/lib/bookings/emails";
import { adminInbox, deliver, type DeliveryResult, type EmailKind } from "@/lib/bookings/notify";
import { EXPERIENCE_TYPES, INQUIRY_STATUSES, MAX_GROUP, PRIVATE_STATUSES } from "@/lib/bookings/validation";

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type EmailOutcome = DeliveryResult["status"] | "skipped";

const uuid = z.uuid();
const note = z.string().trim().max(2000).optional();

/** Maps DB errors from the admin_* functions to string-table codes. */
function dbError(message: string | undefined): { error: string; count?: number } {
  const m = message ?? "";
  const cap = /^capacity:(\d+)$/.exec(m);
  if (cap) return { error: "capacity", count: Number(cap[1]) };
  if (m === "departure_cancelled") return { error: "departureCancelled" };
  if (m.startsWith("transition")) return { error: "transition" };
  return { error: "generic" };
}

async function loadEmailData(db: Db, bookingId: string, adminNote?: string): Promise<BookingEmailData | null> {
  const [{ data: o }, { data: b }] = await Promise.all([
    db.from("booking_overview").select("*").eq("id", bookingId).maybeSingle(),
    db.from("bookings").select("message, special_requests").eq("id", bookingId).maybeSingle(),
  ]);
  if (!o) return null;
  const locale = o.locale as "el" | "en";
  return {
    reference: o.reference,
    locale,
    firstName: o.first_name,
    lastName: o.last_name,
    email: o.email,
    phone: o.phone,
    participants: o.participants,
    excursionTitle: (locale === "el" ? o.excursion_title_el || o.excursion_title_en : o.excursion_title_en || o.excursion_title_el) ?? "OurWay",
    excursionUrl: `${siteConfig.url}/${locale}/activities/${o.excursion_slug}`,
    departureDate: o.departure_date,
    departureTime: o.departure_time,
    unitPriceEur: o.unit_price_eur != null ? Number(o.unit_price_eur) : null,
    totalEur: o.total_eur != null ? Number(o.total_eur) : null,
    message: b?.message ?? null,
    specialRequests: b?.special_requests ?? null,
    preferredPeriod: o.preferred_period ?? null,
    adminNote: adminNote || null,
    kind: o.kind,
  };
}

const KIND_FOR: Record<CustomerBookingEmail, EmailKind> = {
  received: "booking_received",
  confirmed: "booking_confirmed",
  rejected: "booking_rejected",
  cancelled: "booking_cancelled",
};

async function sendAndLog(db: Db, bookingId: string, template: CustomerBookingEmail, adminNote?: string): Promise<EmailOutcome> {
  const data = await loadEmailData(db, bookingId, adminNote);
  if (!data) return "failed";
  const res = await deliver(data.email, adminInbox(), renderCustomerBookingEmail(template, data));
  const { error } = await db.from("email_notifications").insert({
    booking_id: bookingId,
    kind: KIND_FOR[template],
    recipient: res.recipient,
    status: res.status,
    error: res.error ?? null,
  });
  if (error) console.error("[admin] email log:", error.message);
  return res.status;
}

const statusInput = z.object({
  id: uuid,
  status: z.enum(["confirmed", "rejected", "cancelled", "completed"]),
  note,
  notify: z.boolean(),
});

/**
 * The only way a booking is confirmed: an admin action. The database checks
 * the transition and capacity, records history, and only then is the customer
 * emailed. The email result is reported honestly.
 */
export async function setBookingStatus(input: z.input<typeof statusInput>): Promise<ActionResult<{ email: EmailOutcome }> & { count?: number }> {
  await requireAdmin();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { id, status, note: n, notify } = parsed.data;
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_set_booking_status", { p_booking_id: id, p_status: status, p_note: n ?? null });
  if (error) {
    const e = dbError(error.message);
    if (e.error === "generic") console.error("[admin] set status:", error.message);
    return { ok: false, ...e };
  }
  // Places held on the run changed: refresh the dates shown on experience cards.
  updateTag(TAGS.availability);
  const template: CustomerBookingEmail | null = status === "completed" ? null : status;
  const email: EmailOutcome = notify && template ? await sendAndLog(db, id, template, n) : "skipped";
  return { ok: true, data: { email } };
}

export async function extendBookingHold(id: string): Promise<ActionResult & { count?: number }> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "generic" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_extend_booking_hold", { p_booking_id: id });
  if (error) return { ok: false, ...dbError(error.message) };
  updateTag(TAGS.availability);
  return { ok: true };
}

/** Re-sends the customer email that matches the booking's current status. */
export async function resendBookingEmail(id: string): Promise<ActionResult<{ email: EmailOutcome }>> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "generic" };
  const db = await createSupabaseServerClient();
  const { data } = await db.from("bookings").select("kind, status").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "generic" };
  // Inquiries only ever get the "received" email; scheduled requests get the one matching their status.
  const template: CustomerBookingEmail | null =
    data.kind === "interest"
      ? "received"
      : data.status === "pending"
        ? "received"
        : data.status === "completed"
          ? null
          : (data.status as CustomerBookingEmail);
  if (!template) return { ok: false, error: "transition" };
  return { ok: true, data: { email: await sendAndLog(db, id, template) } };
}

const inquiryStatusInput = z.object({ id: uuid, status: z.enum(INQUIRY_STATUSES), note });

/** General-experience inquiry: any of new / contacted / in_progress / closed (recorded in history). No email, no capacity. */
export async function setInquiryStatus(input: z.input<typeof inquiryStatusInput>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = inquiryStatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_set_inquiry_status", {
    p_booking_id: parsed.data.id,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });
  if (error) {
    console.error("[admin] inquiry status:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

const noteInput = z.object({ target: z.enum(["booking", "private"]), id: uuid, body: z.string().trim().min(1).max(4000) });

export async function addRequestNote(input: z.input<typeof noteInput>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { target, id, body } = parsed.data;
  const db = await createSupabaseServerClient();
  const { error } = await db.from("request_notes").insert({
    ...(target === "booking" ? { booking_id: id } : { private_request_id: id }),
    body,
    author_id: admin.id,
  });
  if (error) {
    console.error("[admin] add note:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

/* -------------------- Tailor-made requests (private_requests) ------------------- */

const privateStatusInput = z.object({ id: uuid, status: z.enum(PRIVATE_STATUSES), note });

export async function setPrivateRequestStatus(input: z.input<typeof privateStatusInput>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = privateStatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_set_private_request_status", {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });
  if (error) {
    console.error("[admin] private status:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

const proposalInput = z.object({
  id: uuid,
  proposal_itinerary: z.string().trim().max(10000).transform((v) => v || null),
  proposal_dates: z.string().trim().max(1000).transform((v) => v || null),
  proposal_price_eur: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        ctx.addIssue({ code: "custom", message: "priceInvalid" });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
});

/** Internal planning only — never sent to the customer automatically. */
export async function savePrivateProposal(input: z.input<typeof proposalInput>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = proposalInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "generic" };
  const { id, ...fields } = parsed.data;
  const db = await createSupabaseServerClient();
  const { error, count } = await db.from("private_requests").update(fields, { count: "exact" }).eq("id", id);
  if (error || !count) {
    console.error("[admin] proposal:", error?.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((v) => v || null);
const optDate = z
  .string()
  .trim()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "date")
  .transform((v) => v || null);

const detailsInput = z
  .object({
    id: uuid,
    first_name: z.string().trim().min(1, "required").max(80, "tooLong"),
    last_name: z.string().trim().min(1, "required").max(80, "tooLong"),
    email: z.string().trim().toLowerCase().max(200, "tooLong").pipe(z.email("email")),
    phone: z.string().trim().regex(/^[+()\d\s.-]{6,40}$/, "phone"),
    participants: z.coerce.number().int("participants").min(1, "participants").max(MAX_GROUP, "participants"),
    destination: optText(300),
    experience_type: z.union([z.enum(EXPERIENCE_TYPES), z.literal("")]).transform((v) => v || null),
    date_from: optDate,
    date_to: optDate,
    dates_flexible: z.boolean(),
    budget_per_person: optText(120),
    message: optText(3000),
    additional_requirements: optText(2000),
  })
  .refine((v) => !v.date_from || !v.date_to || v.date_to >= v.date_from, { message: "dateOrder", path: ["date_to"] });

export type TailorMadeDetailsInput = z.input<typeof detailsInput>;

/** Admin correction of a tailor-made request's details (status changes go through setPrivateRequestStatus). */
export async function updateTailorMadeRequest(input: TailorMadeDetailsInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = detailsInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "invalid", fieldErrors };
  }
  const { id, ...fields } = parsed.data;
  const db = await createSupabaseServerClient();
  const { error, count } = await db.from("private_requests").update(fields, { count: "exact" }).eq("id", id);
  if (error || !count) {
    console.error("[admin] tailor-made update:", error?.code, error?.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

/** Permanently deletes a request with its history, notes and email log (cascade). */
export async function deleteTailorMadeRequest(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "generic" };
  const db = await createSupabaseServerClient();
  const { error, count } = await db.from("private_requests").delete({ count: "exact" }).eq("id", id);
  if (error || !count) {
    console.error("[admin] tailor-made delete:", error?.code, error?.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}
