import "server-only";
import { Resend } from "resend";

/**
 * Email delivery abstraction. The contact route only talks to EmailProvider,
 * so switching from Resend to another service means adding one class here.
 */
export type OutgoingEmail = {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<void>;
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;
  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.client = new Resend(apiKey);
  }
  async send(email: OutgoingEmail): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: email.to,
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    if (error) throw new Error(`Resend error: ${error.name}`);
  }
}

export type EmailConfig = { provider: EmailProvider; to: string } | null;

/** Returns null when credentials are missing — callers must NOT pretend to send. */
export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_EMAIL;
  if (!apiKey || !to) return null;
  // Resend's shared sender works without a verified domain (for testing).
  // Set CONTACT_FROM_EMAIL to e.g. "OurWay <hello@your-domain.gr>" once the domain is verified.
  const from = process.env.CONTACT_FROM_EMAIL || "OurWay Website <onboarding@resend.dev>";
  return { provider: new ResendProvider(apiKey, from), to };
}
