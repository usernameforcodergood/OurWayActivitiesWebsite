import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { t } from "../_lib/strings";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-bark">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const btn = {
  primary: "bg-forest text-bone hover:bg-moss",
  secondary: "bg-white text-ink ring-1 ring-ink/15 hover:bg-stone/60",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-ink hover:bg-ink/5",
  publish: "bg-emerald-700 text-white hover:bg-emerald-800",
} as const;

export type BtnVariant = keyof typeof btn;

export function btnClass(variant: BtnVariant = "primary", className?: string) {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
    btn[variant],
    className,
  );
}

export function Btn({ variant = "primary", className, ...props }: { variant?: BtnVariant } & ComponentProps<"button">) {
  return <button type="button" className={btnClass(variant, className)} {...props} />;
}

export function BtnLink({ variant = "primary", className, ...props }: { variant?: BtnVariant } & ComponentProps<typeof Link>) {
  return <Link className={btnClass(variant, className)} {...props} />;
}

export function StatusBadge({ status, label }: { status: "draft" | "published" | "scheduled" | "expired"; label?: string }) {
  const map = {
    draft: ["bg-amber-100 text-amber-900", t.common.draft],
    published: ["bg-emerald-100 text-emerald-900", t.common.published],
    scheduled: ["bg-sky-100 text-sky-900", t.common.scheduled],
    expired: ["bg-stone text-bark", t.common.expired],
  } as const;
  const [cls, text] = map[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{label ?? text}</span>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("admin-card p-5 sm:p-6", className)}>{children}</section>;
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="admin-card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <p className="text-bark">{title}</p>
      {action}
    </div>
  );
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("el-GR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Athens",
  }).format(d);
}
