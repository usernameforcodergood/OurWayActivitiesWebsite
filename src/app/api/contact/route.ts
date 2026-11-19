import { NextResponse } from "next/server";
import { contactSchema, type ContactData, type ContactResponse, type FieldErrorCode } from "@/lib/validation";
import { getEmailConfig } from "@/lib/email";
import { emailNotificationsEnabled } from "@/lib/bookings/notify";
import { getSubmissionSupabase } from "@/lib/supabase/server-secret";
import { clientIp, rateLimited } from "@/lib/rate-limit";

const MIN_FILL_MS = 2500;

function json(body: ContactResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function buildEmail(d: ContactData, reference: string) {
  const rows: Array<[string, string | undefined]> = [
    ["Reference", reference],
    ["Name", d.name],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Interest", d.interest],
    ["Preferred date", d.date],
    ["Participants", d.participants],
    ["Site language", d.locale === "el" ? "Greek" : "English"],
  ];
  const filled = rows.filter((r): r is [string, string] => Boolean(r[1]));
  const text = `${filled.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nMessage:\n${d.message}`;
  const html = `<table cellpadding="6" style="font-family:sans-serif;font-size:14px">${filled
    .map(([k, v]) => `<tr><td style="color:#666">${k}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join("")}</table><p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(d.message)}</p>`;
  return { subject: `OurWay inquiry — ${d.name}`, text, html };
}

/**
 * Contact form. Database first: the message is saved in
 * public.contact_messages (Admin → Μηνύματα) and success depends only on that.
 * An email copy is sent only when EMAIL_NOTIFICATIONS_ENABLED=true, after the
 * save, and its failure never turns a saved message into an error.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    const fields: Partial<Record<string, FieldErrorCode>> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fields[key]) fields[key] = issue.message as FieldErrorCode;
    }
    // Honeypot / timing failures are bots: answer generically, never reveal why.
    if (fields.website || fields.startedAt || fields.idempotencyKey) return json({ ok: false, error: "invalid" }, 400);
    return json({ ok: false, error: "invalid", fields }, 422);
  }

  const data = parsed.data;
  if (Date.now() - data.startedAt < MIN_FILL_MS) return json({ ok: false, error: "invalid" }, 400);

  // Same best-effort limiter as the booking forms: 5 messages per 10 minutes per IP.
  if (rateLimited(`contact:${clientIp(request)}`, 5, 10 * 60 * 1000)) return json({ ok: false, error: "rateLimited" }, 429);

  const db = getSubmissionSupabase();
  if (!db) {
    console.error("[contact] SUPABASE_SECRET_KEY is not set: messages cannot be saved.");
    return json({ ok: false, error: "notConfigured" }, 503);
  }

  const { data: saved, error } = await db.rpc("submit_contact_message", {
    p: {
      idempotency_key: data.idempotencyKey,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      interest: data.interest ?? null,
      preferred_date: data.date ?? null,
      participants: data.participants ?? null,
      message: data.message,
      locale: data.locale,
      consent: data.consent,
    },
  });
  if (error || !saved) {
    const invalid = error?.message === "invalid" || error?.message === "consent";
    if (!invalid) console.error("[contact] save failed:", error?.code, error?.message);
    return json({ ok: false, error: invalid ? "invalid" : "generic" }, invalid ? 422 : 500);
  }
  const result = saved as { id: string; reference: string; replayed: boolean };

  // Optional email copy (off until the domain is ready). Never affects the answer.
  if (!result.replayed && emailNotificationsEnabled()) {
    const config = getEmailConfig();
    if (config) {
      try {
        await config.provider.send({ to: config.to, replyTo: data.email, ...buildEmail(data, result.reference) });
      } catch (err) {
        console.error(`[contact] email via ${config.provider.name} failed (message is saved):`, err instanceof Error ? err.message : "unknown");
      }
    }
  }

  return json({ ok: true, reference: result.reference }, result.replayed ? 200 : 201);
}
