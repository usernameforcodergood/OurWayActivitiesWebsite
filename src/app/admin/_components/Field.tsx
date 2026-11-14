import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { t } from "../_lib/strings";

type Props = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint + accessible error. The control must use `id`. */
export function Field({ id, label, hint, error, optional, className, children }: Props) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-semibold">
        {label}
        {optional && <span className="text-xs font-normal text-bark/80">{t.common.optional}</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-bark">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative mt-0.5 inline-block h-6 w-11 shrink-0 rounded-full bg-ink/20 transition peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-lagoon after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-bark">{hint}</span>}
      </span>
    </label>
  );
}
