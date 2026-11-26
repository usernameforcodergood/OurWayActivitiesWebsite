import { NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cms/public";
import { getSubmissionSupabase } from "@/lib/supabase/server-secret";
import { siteConfig } from "@/lib/site";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { MIN_FILL_MS, bookingRequestSchema, mapDbError, splitFullName, type SubmitResponse } from "@/lib/bookings/validation";
import { renderAdminNewBooking, renderCustomerBookingEmail, type BookingEmailData } from "@/lib/bookings/emails";
import { adminInbox, adminInboxes, deliver, emailNotificationsEnabled, type EmailKind } from "@/lib/bookings/notify";
import { recordBookingOutcome } from "@/lib/analytics/server";

/**
 * Scheduled-excursion participation request or general-experience inquiry.
 * Validated here and again by the database function submit_booking_request(),
 * which checks capacity atomically for scheduled excursions (inquiries never
 * touch capacity), saves the request ("pending" / "new") and returns a
 * reference. This endpoint never confirms anything and takes no payment.
 */
function json(body: SubmitResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

type SubmitResult = { id: string; reference: string; replayed: boolean; email_sent?: boolean; notify_token?: string; kind?: "booking" | "interest"; unit_price_eur?: number | null; total_eur?: number | null };

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const parsed = bookingRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fields[key]) fields[key] = issue.message;
    }
    if (fields.website || fields.startedAt) return json({ ok: false, error: "invalid" }, 400);
    return json({ ok: false, error: "invalid", fields }, 422);
  }
  const d = parsed.data;
  if (Date.now() - d.startedAt < MIN_FILL_MS) return json({ ok: false, error: "invalid" }, 400);
  // Analytics (consenting visitors only, recorded after the response): a failure is a
  // request the server refused; a conversion only exists once the database saved it.
  const failed = (reason: string) => after(() => recordBookingOutcome(request, { ok: false, excursionId: d.excursionId, reason }));
  if (rateLimited(`booking:${clientIp(request)}`, 8, 10 * 60 * 1000)) {
    failed("rateLimited");
    return json({ ok: false, error: "rateLimited" }, 429);
  }

  const db = getSubmissionSupabase();
  if (!db) return json({ ok: false, error: "notConfigured" }, 503);
  const name = splitFullName(d.fullName)!; // guaranteed by the schema

  const { data, error } = await db.rpc("submit_booking_request", {
    p: {
      idempotency_key: d.idempotencyKey,
      excursion_id: d.excursionId,
      departure_id: d.departureId,
      first_name: name.first,
      last_name: name.last,
      email: d.email,
      phone: d.phone,
      participants: d.participants,
      message: d.message ?? null,
      // Stored only for general-experience inquiries (the database ignores it otherwise).
      preferred_period: d.preferredPeriod ?? null,
      locale: d.locale,
      consent: d.consent,
    },
  });
  if (error || !data) {
    const mapped = mapDbError(error?.message);
    if (mapped.error === "generic") console.error("[bookings] submit failed:", error?.code, error?.message);
    const status = mapped.error === "invalid" ? 422 : mapped.error === "generic" ? 500 : 409;
    failed(mapped.error);
    return json({ ok: false, ...mapped }, status);
  }

  const result = data as SubmitResult;
  // A participation request holds places: the dates shown on experience cards may change.
  if (!result.replayed && result.kind === "booking") revalidateTag(TAGS.availability, "max");
  // A retried submission is the same request: it never counts twice.
  if (!result.replayed) after(() => recordBookingOutcome(request, { ok: true, bookingId: result.id }));
  // A retried submission: the request already exists and its emails were handled the first time.
  // Report whether the receipt email of the original submission really went out.
  if (result.replayed || !result.notify_token) return json({ ok: true, reference: result.reference, emailSent: result.email_sent === true }, 200);
  // The request is saved: that alone is success. Emails are optional and off for now.
  if (!emailNotificationsEnabled()) return json({ ok: true, reference: result.reference, emailSent: false }, 201);

  // Details for the emails (public, published data only).
  const [{ data: ex }, dep] = await Promise.all([
    db.from("excursions").select("slug, title_el, title_en").eq("id", d.excursionId).maybeSingle(),
    d.departureId
      ? db.from("departures").select("departure_date, departure_time").eq("id", d.departureId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const title = (d.locale === "el" ? ex?.title_el || ex?.title_en : ex?.title_en || ex?.title_el) ?? "OurWay";
  const emailData: BookingEmailData = {
    reference: result.reference,
    locale: d.locale,
    firstName: name.first,
    lastName: name.last,
    email: d.email,
    phone: d.phone,
    participants: d.participants,
    excursionTitle: title,
    excursionUrl: ex ? `${siteConfig.url}/${d.locale}/activities/${ex.slug}` : undefined,
    departureDate: dep.data?.departure_date ?? null,
    departureTime: dep.data?.departure_time ?? null,
    unitPriceEur: result.unit_price_eur != null ? Number(result.unit_price_eur) : null,
    totalEur: result.total_eur != null ? Number(result.total_eur) : null,
    message: d.message,
    preferredPeriod: d.preferredPeriod,
    kind: result.kind ?? (d.departureId ? "booking" : "interest"),
  };

  const inbox = adminInbox();
  const inboxes = adminInboxes();
  const adminEmail = renderAdminNewBooking(emailData, `${siteConfig.url}/admin/bookings/${result.id}`);
  const [adminRes, customerRes] = await Promise.all([
    inboxes.length ? deliver(inboxes, d.email, adminEmail) : Promise.resolve({ status: "not_configured" as const, recipient: "—", error: "No admin inbox configured" }),
    deliver(d.email, inbox, renderCustomerBookingEmail("received", emailData)),
  ]);

  // Record the real outcome so the admin can follow up on failures.
  const log = (kind: EmailKind, r: { status: string; recipient: string; error?: string }) =>
    db.rpc("record_submission_email", {
      p_reference: result.reference,
      p_token: result.notify_token,
      p_kind: kind,
      p_recipient: r.recipient,
      p_status: r.status,
      p_error: r.error ?? null,
    });
  const logs = await Promise.all([log("admin_new_booking", adminRes), log("booking_received", customerRes)]);
  for (const l of logs) if (l.error) console.error("[bookings] email log failed:", l.error.message);

  return json({ ok: true, reference: result.reference, emailSent: customerRes.status === "sent" }, 201);
}
