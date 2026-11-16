"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { requestPasswordReset, type ForgotState } from "../_actions/recovery";
import { authStrings, withLang, type AuthLang } from "../_lib/auth-strings";

export function ForgotPasswordForm({ lang }: { lang: AuthLang }) {
  const s = authStrings[lang].forgot;
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, { status: "idle" });
  const [dismissed, setDismissed] = useState<ForgotState | null>(null);
  const sent = state.status === "sent" && dismissed !== state;
  const error = state.status === "invalidEmail" ? s.invalidEmail : state.status === "notConfigured" ? s.notConfigured : undefined;

  const back = (
    <Link
      href={withLang("/admin/login", lang)}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {s.back}
    </Link>
  );

  if (sent) {
    return (
      <div className="space-y-5">
        <p role="status" className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          {s.sent}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {back}
          <button type="button" onClick={() => setDismissed(state)} className="text-sm text-bark underline-offset-4 hover:underline">
            {s.sendAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          {s.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          maxLength={254}
          defaultValue={state.email}
          className="admin-input"
          aria-invalid={state.status === "invalidEmail" || undefined}
          aria-describedby={error ? "forgot-error" : undefined}
        />
      </div>

      {error && (
        <p id="forgot-error" role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || state.status === "notConfigured"}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 font-semibold text-bone transition hover:bg-moss disabled:opacity-60"
      >
        <Mail aria-hidden className="size-4" />
        {pending ? s.submitting : s.submit}
      </button>

      <div className="text-center">{back}</div>
    </form>
  );
}
