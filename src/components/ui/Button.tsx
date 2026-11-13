import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "outline-dark" | "text";

const base =
  "group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full font-semibold tracking-tight transition-colors duration-500 ease-out-expo min-h-12 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-sand text-ink px-7 py-3.5 text-[0.95rem] hover:text-ink",
  outline: "border border-bone/35 text-bone px-7 py-3.5 text-[0.95rem] hover:border-bone hover:text-ink",
  "outline-dark": "border border-ink/30 text-ink px-7 py-3.5 text-[0.95rem] hover:border-ink hover:text-bone",
  text: "text-current px-0 py-2 text-[0.95rem] min-h-11 rounded-none",
};

const fill: Record<Variant, string | null> = {
  primary: "bg-bone",
  outline: "bg-bone",
  "outline-dark": "bg-ink",
  text: null,
};

type Common = { variant?: Variant; children: ReactNode; className?: string; icon?: boolean };

/** Rounded pill with a fill that rises from below on hover. */
function Inner({ variant = "primary", children, icon = true }: Common) {
  const f = fill[variant];
  return (
    <>
      {f && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 translate-y-[101%] rounded-[inherit] transition-transform duration-500 ease-out-expo group-hover:translate-y-0",
            f,
          )}
        />
      )}
      <span className={cn("relative", variant === "text" && "bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-out-expo group-hover:bg-[length:100%_1px]")}>
        {children}
      </span>
      {icon && (
        <ArrowUpRight
          aria-hidden
          className="relative size-4 shrink-0 transition-transform duration-500 ease-out-expo group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-45"
          strokeWidth={1.75}
        />
      )}
    </>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  children,
  icon,
  ...props
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], className)} {...props}>
      <Inner variant={variant} icon={icon}>
        {children}
      </Inner>
    </Link>
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  icon,
  ...props
}: Common & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], "disabled:cursor-not-allowed disabled:opacity-60", className)} {...props}>
      <Inner variant={variant} icon={icon}>
        {children}
      </Inner>
    </button>
  );
}
