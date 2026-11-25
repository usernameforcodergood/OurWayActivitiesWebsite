import "server-only";
import { getEmailConfig, parseAddressList } from "@/lib/email";
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

/**
 * Inboxes that receive new-request notifications. BOOKINGS_EMAIL (or else
 * CONTACT_EMAIL) may list several addresses separated by commas; every one of
 * them gets each notification.
 */
export function adminInboxes(): string[] {
  return parseAddressList(process.env.BOOKINGS_EMAIL || process.env.CONTACT_EMAIL);
}

/** The main inbox (the first one listed): the reply-to address of customer emails. */
export function adminInbox(): string | null {
  return adminInboxes()[0] ?? null;
}

/**
 * Sends one email and reports what really happened. Never throws and never
 * reports "sent" unless the provider accepted the message.
 */
export async function deliver(to: string | string[], replyTo: string | null, email: Rendered): Promise<DeliveryResult> {
  const recipient = Array.isArray(to) ? to.join(", ") : to;
  if (!emailNotificationsEnabled()) return { status: "not_configured", error: "Email notifications are disabled", recipient };
  const config = getEmailConfig();
  if (!config) return { status: "not_configured", error: "RESEND_API_KEY / CONTACT_EMAIL not set", recipient };
  try {
    await config.provider.send({ to, replyTo: replyTo ?? config.to, ...email });
    return { status: "sent", recipient };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    // No personal data in logs: only the provider's error.
    console.error(`[bookings] email via ${config.provider.name} failed: ${message}`);
    return { status: "failed", error: message.slice(0, 500), recipient };
  }
}
