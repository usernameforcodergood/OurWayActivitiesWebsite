import { NextResponse } from "next/server";
import { getPublicSupabase } from "@/lib/supabase/public";
import { siteConfig } from "@/lib/site";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { MIN_FILL_MS, mapDbError, privateRequestSchema, type PrivateRequestData, type SubmitResponse } from "@/lib/bookings/validation";
import { formatDateLong, renderAdminNewPrivate, renderPrivateReceived } from "@/lib/bookings/emails";
import { adminInbox, deliver, type EmailKind } from "@/lib/bookings/notify";

/** "Design your own excursion" request. Saved as "new"; never a booking or a quote. */
function json(body: SubmitResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const LABELS = {
  el: {
    destination: "Προορισμός",
    flexible: "Ανοιχτό / θα το συζητήσουμε",
    type: "Είδος εκδρομής",
    dates: "Ημερομηνίες",
    duration: "Διάρκεια",
    difficulty: "Δυσκολία",
    transport: "Μετακίνηση",
    activities: "Δραστηριότητες / αιτήματα",
    budget: "Ενδεικτικός προϋπολογισμός ανά άτομο",
    message: "Μήνυμα",
  },
  en: {
    destination: "Destination",
    flexible: "Open / to be discussed",
    type: "Type of trip",
    dates: "Dates",
    duration: "Duration",
    difficulty: "Difficulty",
    transport: "Transport",
    activities: "Activities / requests",
    budget: "Indicative budget per person",
    message: "Message",
  },
} as const;

function details(d: PrivateRequestData, locale: "el" | "en"): Array<[string, string]> {
  const L = LABELS[locale];
  const out: Array<[string, string]> = [];
  const dest = [d.destination, d.destinationFlexible ? L.flexible : null].filter(Boolean).join(" · ");
  if (dest) out.push([L.destination, dest]);
  if (d.excursionType) out.push([L.type, d.excursionType]);
  const range = [d.dateFrom, d.dateTo].filter(Boolean).map((x) => formatDateLong(x!, locale));
  const dates = [range.join(" – "), d.datesFlexible ? L.flexible : null].filter(Boolean).join(" · ");
  if (dates) out.push([L.dates, dates]);
  if (d.duration) out.push([L.duration, d.duration]);
  if (d.difficulty) out.push([L.difficulty, d.difficulty]);
  if (d.transport) out.push([L.transport, d.transport]);
  if (d.activities) out.push([L.activities, d.activities]);
  if (d.budgetPerPerson) out.push([L.budget, d.budgetPerPerson]);
  if (d.message) out.push([L.message, d.message]);
  return out;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const parsed = privateRequestSchema.safeParse(payload);
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
  if (rateLimited(`private:${clientIp(request)}`, 5, 10 * 60 * 1000)) return json({ ok: false, error: "rateLimited" }, 429);

  const db = getPublicSupabase();
  if (!db) return json({ ok: false, error: "notConfigured" }, 503);

  const { data, error } = await db.rpc("submit_private_request", {
    p: {
      idempotency_key: d.idempotencyKey,
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email,
      phone: d.phone,
      participants: d.participants,
      destination: d.destination ?? null,
      destination_flexible: d.destinationFlexible,
      excursion_type: d.excursionType ?? null,
      date_from: d.dateFrom ?? null,
      date_to: d.dateTo ?? null,
      dates_flexible: d.datesFlexible,
      duration: d.duration ?? null,
      difficulty: d.difficulty ?? null,
      transport: d.transport ?? null,
      activities: d.activities ?? null,
      budget_per_person: d.budgetPerPerson ?? null,
      message: d.message ?? null,
      locale: d.locale,
      consent: d.consent,
    },
  });
  if (error || !data) {
    const mapped = mapDbError(error?.message);
    if (mapped.error === "generic") console.error("[private] submit failed:", error?.code, error?.message);
    return json({ ok: false, ...mapped }, mapped.error === "invalid" ? 422 : mapped.error === "generic" ? 500 : 409);
  }
  const result = data as { id: string; reference: string; replayed: boolean; email_sent?: boolean; notify_token?: string };
  // Report whether the receipt email of the original submission really went out.
  if (result.replayed || !result.notify_token) return json({ ok: true, reference: result.reference, emailSent: result.email_sent === true }, 200);

  const base = { reference: result.reference, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, participants: d.participants };
  const inbox = adminInbox();
  const [adminRes, customerRes] = await Promise.all([
    inbox
      ? deliver(inbox, d.email, renderAdminNewPrivate({ ...base, locale: "el", details: details(d, "el") }, `${siteConfig.url}/admin/private-requests/${result.id}`))
      : Promise.resolve({ status: "not_configured" as const, recipient: "—", error: "No admin inbox configured" }),
    deliver(d.email, inbox, renderPrivateReceived({ ...base, locale: d.locale, details: details(d, d.locale) })),
  ]);
  const log = (kind: EmailKind, r: { status: string; recipient: string; error?: string }) =>
    db.rpc("record_submission_email", {
      p_reference: result.reference,
      p_token: result.notify_token,
      p_kind: kind,
      p_recipient: r.recipient,
      p_status: r.status,
      p_error: r.error ?? null,
    });
  const logs = await Promise.all([log("admin_new_private", adminRes), log("private_received", customerRes)]);
  for (const l of logs) if (l.error) console.error("[private] email log failed:", l.error.message);

  return json({ ok: true, reference: result.reference, emailSent: customerRes.status === "sent" }, 201);
}
