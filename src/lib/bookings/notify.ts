import "server-only";
import { getEmailConfig } from "@/lib/email";
import type { Rendered } from "./emails";

export type EmailKind =
  | "admin_new_booking"
  | "booking_received"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "admin_new_private"
  | "private_received";

export type DeliveryResult = { status: "sent" | "failed" | "not_configured"; error?: string; recipient: string };

/**
 * Email notifications are OFF unless EMAIL_NOTIFICATIONS_ENABLED=true
 * (set on the host's environment variables and in .env.local).
 * While off, nothing is sent to Resend from any route or admin action, and
 * saving a request never depends on email.
 */
export function emailNotificationsEnabled(): boolean {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
}

/** Inbox that receives new-request notifications. */
export function adminInbox(): string | null {
  return process.env.BOOKINGS_EMAIL || process.env.CONTACT_EMAIL || null;
}

/**
 * Sends one email and reports what really happened. Never throws and never
 * reports "sent" unless the provider accepted the message.
 */
export async function deliver(to: string, replyTo: string | null, email: Rendered): Promise<DeliveryResult> {
  if (!emailNotificationsEnabled()) return { status: "not_configured", error: "Email notifications are disabled", recipient: to };
  const config = getEmailConfig();
  if (!config) return { status: "not_configured", error: "RESEND_API_KEY / CONTACT_EMAIL not set", recipient: to };
  try {
    await config.provider.send({ to, replyTo: replyTo ?? config.to, ...email });
    return { status: "sent", recipient: to };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    // No personal data in logs: only the provider's error.
    console.error(`[bookings] email via ${config.provider.name} failed: ${message}`);
    return { status: "failed", error: message.slice(0, 500), recipient: to };
  }
}
