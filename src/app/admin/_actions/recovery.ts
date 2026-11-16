"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { siteConfig } from "@/lib/site";
import { getPublicSupabase } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, resolveAuthLang, withLang } from "../_lib/auth-strings";
import { RECOVERY_COOKIE } from "../_lib/recovery";

// ---------------------------------------------------------------------------
// Step 1 — request a reset link
// ---------------------------------------------------------------------------

export type ForgotState = { status: "idle" | "sent" | "invalidEmail" | "notConfigured"; email?: string };

/** Every accepted request takes at least this long, whether an email is sent or not. */
const MIN_RESPONSE_MS = 1500;

const emailSchema = z.email().max(254);

export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const started = Date.now();
  const email = String(formData.get("email") ?? "").trim();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { status: "invalidEmail", email };

  const supabase = getPublicSupabase();
  const recoveryKey = process.env.ADMIN_RECOVERY_KEY;
  if (!supabase || !recoveryKey) return { status: "notConfigured" };

  try {
    // Server-side eligibility check: only confirmed, non-banned users listed
    // in admin_users. The database only answers callers holding the
    // server-only ADMIN_RECOVERY_KEY (see migration 0002).
    const { data: eligible, error } = await supabase.rpc("admin_recovery_eligible", {
      p_email: parsed.data,
      p_key: recoveryKey,
    });
    if (error) {
      console.error("[password-recovery] eligibility check failed:", error.code, error.message);
    } else if (eligible === true) {
      // Supabase Auth creates the single-use, time-limited token and sends the
      // "Reset password" email template (supabase/templates/reset-password.html).
      // The cookie-less client is used on purpose: nothing is stored in the
      // requester's browser, so the response looks identical for every email.
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${siteConfig.url}/admin/reset-password`,
      });
      if (sendError) console.error("[password-recovery] send failed:", sendError.status, sendError.code ?? sendError.message);
    }
  } catch (err) {
    console.error("[password-recovery] unexpected error:", err instanceof Error ? err.message : err);
  }

  // Same message and (roughly) same timing whether or not the account exists.
  const remaining = MIN_RESPONSE_MS - (Date.now() - started);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining + Math.floor(Math.random() * 250)));
  return { status: "sent" };
}

// ---------------------------------------------------------------------------
// Step 2a — Supabase's default email template
// Its link goes through Supabase's /verify endpoint, which uses up the token
// and redirects to /admin/reset-password#access_token=…&type=recovery. The
// page hands those tokens to this action once, which stores them as the
// (httpOnly) session after Supabase confirms them, and only for administrators.
// ---------------------------------------------------------------------------

const JWT_RE = /^[\w-]+\.[\w-]+\.[\w-]+$/;

export async function acceptRecoveryTokens(accessToken: string, refreshToken: string): Promise<{ ok: boolean }> {
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") return { ok: false };
  if (!JWT_RE.test(accessToken) || accessToken.length > 4096 || !/^[\w-]{6,512}$/.test(refreshToken)) return { ok: false };

  const supabase = await createSupabaseServerClient();
  // setSession validates the access token with Supabase Auth before accepting it.
  const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error || !data.user) return { ok: false };

  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { ok: false };
  }

  (await cookies()).set(RECOVERY_COOKIE, data.user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 15 * 60,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 2 — choose a new password from the emailed link
// ---------------------------------------------------------------------------

export type ResetError = "short" | "long" | "mismatch" | "invalidLink" | "samePassword" | "weak" | "rateLimited" | "generic";
export type ResetState = { error?: ResetError; verified?: boolean };

const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{16,256}$/;

export async function completePasswordReset(prev: ResetState, formData: FormData): Promise<ResetState> {
  const lang = resolveAuthLang(formData.get("lang"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const tokenHash = String(formData.get("token_hash") ?? "");
  const verified = prev.verified;

  // Validate first: a typo must never consume the single-use link.
  if (password.length < PASSWORD_MIN_LENGTH) return { error: "short", verified };
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return { error: "long", verified };
  if (password !== confirm) return { error: "mismatch", verified };

  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();

  if (tokenHash && !verified) {
    if (!TOKEN_HASH_RE.test(tokenHash)) return { error: "invalidLink" };
    // Exchanges the emailed token for a recovery session. Supabase rejects
    // expired, malformed and already-used tokens here.
    const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (error || !data.user) return { error: error?.status === 429 ? "rateLimited" : "invalidLink" };

    // Only administrators may finish the flow; anyone else is signed out again.
    const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!admin) {
      await supabase.auth.signOut();
      return { error: "invalidLink" };
    }

    // Lets the admin retry (e.g. "same password") without a second link.
    cookieStore.set(RECOVERY_COOKIE, data.user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/admin",
      maxAge: 15 * 60,
    });
  } else {
    // Retry after a verified link: the recovery session must still belong to
    // the same administrator.
    const marker = cookieStore.get(RECOVERY_COOKIE)?.value;
    const admin = await getAdmin();
    if (!marker || admin.status !== "admin" || admin.id !== marker) return { error: "invalidLink" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code =
      error.code === "same_password"
        ? "samePassword"
        : error.code === "weak_password"
          ? "weak"
          : error.status === 429
            ? "rateLimited"
            : "generic";
    return { error: code, verified: true };
  }

  // End the recovery session everywhere (and any other session of this
  // account) so the administrator must sign in with the new password.
  await supabase.auth.signOut({ scope: "global" });
  cookieStore.delete({ name: RECOVERY_COOKIE, path: "/admin" });
  redirect(withLang("/admin/login?reset=success", lang));
}
