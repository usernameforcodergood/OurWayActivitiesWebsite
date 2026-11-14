"use client";

import { useActionState } from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { signIn, type LoginState } from "../_actions/auth";
import { t } from "../_lib/strings";

export function LoginForm({ next, initialError }: { next?: string; initialError?: LoginState["error"] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: initialError });
  const error = state.error;

  return (
    <form action={action} className="space-y-5" noValidate={false}>
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
          {t.login.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className="admin-input"
          aria-invalid={error === "invalid" || undefined}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
          {t.login.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="admin-input"
          aria-invalid={error === "invalid" || undefined}
        />
      </div>

      {error && (
        <p role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.login[error]}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || error === "notConfigured"}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 font-semibold text-bone transition hover:bg-moss disabled:opacity-60"
      >
        <LogIn aria-hidden className="size-4" />
        {pending ? t.login.submitting : t.login.submit}
      </button>
    </form>
  );
}
