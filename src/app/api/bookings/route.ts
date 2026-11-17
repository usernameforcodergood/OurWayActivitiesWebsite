import { NextResponse } from "next/server";
import { getPublicSupabase } from "@/lib/supabase/public";
import { siteConfig } from "@/lib/site";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { MIN_FILL_MS, bookingRequestSchema, mapDbError, type SubmitResponse } from "@/lib/bookings/validation";
import { renderAdminNewBooking, renderCustomerBookingEmail, type BookingEmailData } from "@/lib/bookings/emails";
import { adminInbox, deliver, type EmailKind } from "@/lib/bookings/notify";
import { logKeyRefusal, submissionKey } from "@/lib/bookings/submission-key";

/**
 * Booking request / expression of interest. The request is validated here and
 * again by the database function submit_booking_request(), which checks
 * capacity atomically, saves the request as "pending" and returns a
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
  if (rateLimited(`booking:${clientIp(request)}`, 8, 10 * 60 * 1000)) return json({ ok: false, error: "rateLimited" }, 429);

  const db = getPublicSupabase();
  if (!db) return json({ ok: false, error: "notConfigured" }, 503);

  const { data, error } = await db.rpc("submit_booking_request", {
    p: {
      idempotency_key: d.idempotencyKey,
      excursion_id: d.excursionId,
      departure_id: d.departureId,
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email,
      phone: d.phone,
      participants: d.participants,
      message: d.message ?? null,
      special_requests: d.specialRequests ?? null,
      locale: d.locale,
      consent: d.consent,
      submission_key: submissionKey(),
    },
  });
  if (error || !data) {
    if (logKeyRefusal("bookings", error?.message)) return json({ ok: false, error: "notConfigured" }, 503);
    const mapped = mapDbError(error?.message);
    if (mapped.error === "generic") console.error("[bookings] submit failed:", error?.code, error?.message);
    const status = mapped.error === "invalid" ? 422 : mapped.error === "generic" ? 500 : 409;
    return json({ ok: false, ...mapped }, status);
  }

  const result = data as SubmitResult;
  // A retried submission: the request already exists and its emails were handled the first time.
  // Report whether the receipt email of the original submission really went out.
  if (result.replayed || !result.notify_token) return json({ ok: true, reference: result.reference, emailSent: result.email_sent === true }, 200);

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
    firstName: d.firstName,
    lastName: d.lastName,
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
    specialRequests: d.specialRequests,
    kind: result.kind ?? (d.departureId ? "booking" : "interest"),
  };

  const inbox = adminInbox();
  const adminEmail = renderAdminNewBooking(emailData, `${siteConfig.url}/admin/bookings/${result.id}`);
  const [adminRes, customerRes] = await Promise.all([
    inbox ? deliver(inbox, d.email, adminEmail) : Promise.resolve({ status: "not_configured" as const, recipient: "—", error: "No admin inbox configured" }),
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
