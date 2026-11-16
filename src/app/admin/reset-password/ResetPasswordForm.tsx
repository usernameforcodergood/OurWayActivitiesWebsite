"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, KeyRound } from "lucide-react";
import { completePasswordReset, type ResetError, type ResetState } from "../_actions/recovery";
import { authStrings, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, withLang, type AuthLang } from "../_lib/auth-strings";

function PasswordInput({
  id,
  label,
  hint,
  invalid,
  describedBy,
  visible,
  onToggle,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  invalid: boolean;
  describedBy?: string;
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_BYTES}
          spellCheck={false}
          autoCapitalize="none"
          className="admin-input pr-11"
          aria-invalid={invalid || undefined}
          aria-describedby={[hint ? `${id}-hint` : "", describedBy ?? ""].filter(Boolean).join(" ") || undefined}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-bark hover:text-forest focus-visible:outline-2 focus-visible:outline-lagoon"
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-bark">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ResetPasswordForm({ lang, tokenHash, verified }: { lang: AuthLang; tokenHash?: string; verified: boolean }) {
  const s = authStrings[lang].reset;
  const [state, action, pending] = useActionState<ResetState, FormData>(completePasswordReset, { verified });
  const [show, setShow] = useState(false);
  const [clientError, setClientError] = useState<ResetError | null>(null);

  const error = clientError ?? state.error;

  if (state.error === "invalidLink" && !clientError) {
    return (
      <div className="space-y-5">
        <p role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {s.invalidLink}
        </p>
        <Link
          href={withLang("/admin/forgot-password", lang)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-forest px-4 py-2.5 font-semibold text-bone transition hover:bg-moss"
        >
          {s.requestNew}
        </Link>
      </div>
    );
  }

  const fieldError = error === "short" || error === "long" ? "password" : error === "mismatch" ? "confirm" : null;

  return (
    <form
      action={action}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        // Instant feedback; the server repeats every check.
        const data = new FormData(e.currentTarget);
        const password = String(data.get("password") ?? "");
        const confirm = String(data.get("confirm") ?? "");
        const next: ResetError | null =
          password.length < PASSWORD_MIN_LENGTH
            ? "short"
            : new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES
              ? "long"
              : password !== confirm
                ? "mismatch"
                : null;
        setClientError(next);
        if (next) e.preventDefault();
      }}
    >
      <input type="hidden" name="lang" value={lang} />
      {tokenHash && !state.verified && <input type="hidden" name="token_hash" value={tokenHash} />}

      <PasswordInput
        id="password"
        label={s.password}
        hint={s.hint}
        invalid={fieldError === "password"}
        describedBy={error ? "reset-error" : undefined}
        visible={show}
        onToggle={() => setShow((v) => !v)}
        showLabel={s.show}
        hideLabel={s.hide}
      />
      <PasswordInput
        id="confirm"
        label={s.confirm}
        invalid={fieldError === "confirm"}
        describedBy={error ? "reset-error" : undefined}
        visible={show}
        onToggle={() => setShow((v) => !v)}
        showLabel={s.show}
        hideLabel={s.hide}
      />

      {error && error !== "invalidLink" && (
        <p id="reset-error" role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {s.errors[error]}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 font-semibold text-bone transition hover:bg-moss disabled:opacity-60"
      >
        <KeyRound aria-hidden className="size-4" />
        {pending ? s.submitting : s.submit}
      </button>

      <div className="text-center">
        <Link href={withLang("/admin/login", lang)} className="text-sm font-semibold text-forest underline-offset-4 hover:underline">
          {s.back}
        </Link>
      </div>
    </form>
  );
}
