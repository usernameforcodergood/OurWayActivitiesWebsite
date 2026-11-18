import { NextResponse } from "next/server";
import { contactSchema, type ContactData, type ContactResponse, type FieldErrorCode } from "@/lib/validation";
import { getEmailConfig } from "@/lib/email";
import { clientIp, rateLimited } from "@/lib/rate-limit";

const MIN_FILL_MS = 2500;

function json(body: ContactResponse, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function buildEmail(d: ContactData) {
  const rows: Array<[string, string | undefined]> = [
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
    if (fields.website || fields.startedAt) return json({ ok: false, error: "invalid" }, 400);
    return json({ ok: false, error: "invalid", fields }, 422);
  }

  const data = parsed.data;
  if (Date.now() - data.startedAt < MIN_FILL_MS) return json({ ok: false, error: "invalid" }, 400);

  // Same best-effort limiter as the booking forms: 5 messages per 10 minutes per IP.
  if (rateLimited(`contact:${clientIp(request)}`, 5, 10 * 60 * 1000)) return json({ ok: false, error: "rateLimited" }, 429);

  const config = getEmailConfig();
  if (!config) {
    // Honest failure: nothing is sent and nothing is stored.
    console.warn("[contact] Email delivery is not configured. Set RESEND_API_KEY and CONTACT_EMAIL.");
    return json({ ok: false, error: "notConfigured" }, 503);
  }

  try {
    const email = buildEmail(data);
    await config.provider.send({ to: config.to, replyTo: data.email, ...email });
    return json({ ok: true }, 200);
  } catch (err) {
    // Log the failure without any personal data from the submission.
    console.error(`[contact] Delivery via ${config.provider.name} failed:`, err instanceof Error ? err.message : "unknown");
    return json({ ok: false, error: "generic" }, 502);
  }
}
