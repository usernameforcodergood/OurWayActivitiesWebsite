"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, type PasswordResult } from "../_actions/auth";
import { t } from "../_lib/strings";
import { useToast } from "./Toast";
import { Field } from "./Field";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordResult | null, FormData>(changePassword, null);
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      toast("success", t.settings.passwordChanged);
      form.current?.reset();
    }
  }, [state, toast]);

  const error =
    state?.error === "short" ? t.settings.passwordShort : state?.error === "mismatch" ? t.settings.passwordMismatch : state?.error ? t.common.error : undefined;

  return (
    <form ref={form} action={action} className="space-y-4">
      <Field id="password" label={t.settings.newPassword} hint={t.settings.passwordShort}>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="admin-input" />
      </Field>
      <Field id="confirm" label={t.settings.confirmPassword} error={error}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="admin-input" aria-invalid={Boolean(error) || undefined} />
      </Field>
      <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-forest px-4 text-sm font-semibold text-bone hover:bg-moss disabled:opacity-60">
        {pending ? t.common.saving : t.settings.changePassword}
      </button>
    </form>
  );
}
