import "server-only";

/**
 * Server-only key that the database requires on every public form submission
 * (see supabase/migrations/0005_submission_key.sql). It proves the call comes
 * from this website's server, after the honeypot, fill-timer and rate-limit
 * checks — not from someone calling the database directly with the public key.
 */
export function submissionKey(): string | null {
  return process.env.SUBMISSION_KEY || null;
}

/** Logs a refused submission clearly; the visitor sees "not available yet". */
export function logKeyRefusal(scope: string, message: string | undefined): boolean {
  if (message !== "not allowed") return false;
  console.error(
    `[${scope}] database refused the submission: SUBMISSION_KEY is ${submissionKey() ? "wrong" : "not set"} on this server (see README → "Form submission key").`,
  );
  return true;
}
