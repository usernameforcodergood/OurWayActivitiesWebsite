import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control + accessible error message. Control must use id / aria-describedby `${id}-error`. */
export function FormField({ id, label, required, optionalLabel, error, className, children }: Props) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        <span>
          {label}
          {required && (
            <span aria-hidden className="text-clay">
              {" "}*
            </span>
          )}
        </span>
        {!required && optionalLabel && <span className="text-xs font-normal text-bark">{optionalLabel}</span>}
      </label>
      {children}
      <p id={`${id}-error`} role={error ? "alert" : undefined} className={cn("mt-2 min-h-5 text-sm text-[#9a3b1f]", !error && "sr-only")}>
        {error}
      </p>
    </div>
  );
}

export const inputClass =
  "w-full rounded-none border-0 border-b border-ink/25 bg-transparent px-0 py-3 text-base text-ink placeholder:text-bark/60 transition-colors focus:border-ink focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-[#9a3b1f]";
