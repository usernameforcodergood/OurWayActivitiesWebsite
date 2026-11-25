import { NextResponse } from "next/server";
import { getSubmissionSupabase } from "@/lib/supabase/server-secret";
import { siteConfig } from "@/lib/site";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import {
  MIN_FILL_MS,
  mapDbError,
  splitFullName,
  tailorMadeRequestSchema,
  type ExperienceType,
  type SubmitResponse,
  type TailorMadeRequestData,
} from "@/lib/bookings/validation";
import { formatDateLong, renderAdminNewPrivate, renderPrivateReceived } from "@/lib/bookings/emails";
import { adminInbox, adminInboxes, deliver, emailNotificationsEnabled, type EmailKind } from "@/lib/bookings/notify";

/**
 * Tailor-made experience request. Saved as "new" in public.private_requests;
 * never a booking or a quote. Kept apart from excursion bookings.
 */
function json(body: SubmitResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const TYPES: Record<"el" | "en", Record<ExperienceType, string>> = {
  el: {
    hiking: "Πεζοπορία",
    adventure: "Περιπέτεια",
    nature: "Εξερεύνηση της φύσης",
    culture: "Πολιτιστική εμπειρία",
    gastronomy: "Γαστρονομία",
    multi_day: "Πολυήμερη εκδρομή",
    other: "Άλλο",
  },
  en: {
    hiking: "Hiking",
    adventure: "Adventure",
    nature: "Nature exploration",
    culture: "Cultural experience",
    gastronomy: "Gastronomy",
    multi_day: "Multi-day excursion",
    other: "Other",
  },
};

const LABELS = {
  el: {
    type: "Είδος εμπειρίας",
    destination: "Προτιμώμενος προορισμός",
    dates: "Επιθυμητές ημερομηνίες",
    flexible: "ευέλικτες",
    budget: "Ενδεικτικός προϋπολογισμός ανά άτομο",
    description: "Η εμπειρία που φαντάζεστε",
    additional: "Επιπλέον απαιτήσεις",
  },
  en: {
    type: "Type of experience",
    destination: "Preferred destination",
    dates: "Desired dates",
    flexible: "flexible",
    budget: "Approximate budget per person",
    description: "The experience you have in mind",
    additional: "Additional requirements",
  },
} as const;

function details(d: TailorMadeRequestData, locale: "el" | "en"): Array<[string, string]> {
  const L = LABELS[locale];
  const out: Array<[string, string]> = [[L.type, TYPES[locale][d.experienceType]]];
  if (d.destination) out.push([L.destination, d.destination]);
  const range = [d.dateFrom, d.dateTo].filter(Boolean).map((x) => formatDateLong(x!, locale)).join(" – ");
  out.push([L.dates, d.datesFlexible ? `${range} (${L.flexible})` : range]);
  if (d.budgetPerPerson) out.push([L.budget, d.budgetPerPerson]);
  out.push([L.description, d.description]);
  if (d.additionalRequirements) out.push([L.additional, d.additionalRequirements]);
  return out;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const parsed = tailorMadeRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fields[key]) fields[key] = issue.message;
    }
    // Honeypot / missing timer: a bot. Answer vaguely.
    if (fields.website || fields.startedAt) return json({ ok: false, error: "invalid" }, 400);
    return json({ ok: false, error: "invalid", fields }, 422);
  }
  const d = parsed.data;
  if (Date.now() - d.startedAt < MIN_FILL_MS) return json({ ok: false, error: "invalid" }, 400);
  if (rateLimited(`tailor:${clientIp(request)}`, 5, 10 * 60 * 1000)) return json({ ok: false, error: "rateLimited" }, 429);

  const db = getSubmissionSupabase();
  if (!db) return json({ ok: false, error: "notConfigured" }, 503);

  const name = splitFullName(d.fullName)!; // guaranteed by the schema
  const { data, error } = await db.rpc("submit_private_request", {
    p: {
      idempotency_key: d.idempotencyKey,
      first_name: name.first,
      last_name: name.last,
      email: d.email,
      phone: d.phone,
      participants: d.participants,
      destination: d.destination ?? null,
      experience_type: d.experienceType,
      date_from: d.dateFrom,
      date_to: d.dateTo ?? null,
      dates_flexible: d.datesFlexible,
      budget_per_person: d.budgetPerPerson ?? null,
      message: d.description,
      additional_requirements: d.additionalRequirements ?? null,
      locale: d.locale,
      consent: d.consent,
    },
  });
  if (error || !data) {
    const mapped = mapDbError(error?.message);
    if (mapped.error === "generic") console.error("[tailor-made] submit failed:", error?.code, error?.message);
    return json({ ok: false, ...mapped }, mapped.error === "invalid" ? 422 : mapped.error === "generic" ? 500 : 409);
  }
  const result = data as { id: string; reference: string; replayed: boolean; email_sent?: boolean; notify_token?: string };
  // Report whether the receipt email of the original submission really went out.
  if (result.replayed || !result.notify_token) return json({ ok: true, reference: result.reference, emailSent: result.email_sent === true }, 200);
  // The request is saved: that alone is success. Emails are optional and off for now.
  if (!emailNotificationsEnabled()) return json({ ok: true, reference: result.reference, emailSent: false }, 201);

  const base = { reference: result.reference, firstName: name.first, lastName: name.last, email: d.email, phone: d.phone, participants: d.participants };
  const inbox = adminInbox();
  const inboxes = adminInboxes();
  const [adminRes, customerRes] = await Promise.all([
    inboxes.length
      ? deliver(inboxes, d.email, renderAdminNewPrivate({ ...base, locale: "el", details: details(d, "el") }, `${siteConfig.url}/admin/tailor-made/${result.id}`))
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
  for (const l of logs) if (l.error) console.error("[tailor-made] email log failed:", l.error.message);

  return json({ ok: true, reference: result.reference, emailSent: customerRes.status === "sent" }, 201);
}
