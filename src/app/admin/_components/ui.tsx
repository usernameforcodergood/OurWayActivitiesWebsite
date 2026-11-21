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

const BOOKING_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  cancelled: "bg-stone text-bark",
  completed: "bg-sky-100 text-sky-900",
  // General-experience inquiries
  new: "bg-amber-100 text-amber-900",
  contacted: "bg-sky-100 text-sky-900",
  in_progress: "bg-indigo-100 text-indigo-900",
  closed: "bg-stone text-bark",
};

export function BookingStatusBadge({ status }: { status: keyof typeof t.bookings.statuses }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", BOOKING_BADGE[status])}>
      {t.bookings.statuses[status]}
    </span>
  );
}

const PAYMENT_BADGE: Record<keyof typeof t.payments.statuses, string> = {
  unpaid: "bg-stone text-bark",
  partial: "bg-amber-100 text-amber-900",
  deposit_paid: "bg-sky-100 text-sky-900",
  paid: "bg-emerald-100 text-emerald-900",
  refunded: "bg-violet-100 text-violet-900",
};

export function PaymentStatusBadge({ status }: { status: keyof typeof t.payments.statuses }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", PAYMENT_BADGE[status])}>
      {t.payments.statuses[status]}
    </span>
  );
}

const PRIVATE_BADGE: Record<string, string> = {
  new: "bg-amber-100 text-amber-900",
  in_review: "bg-indigo-100 text-indigo-900",
  contacted: "bg-sky-100 text-sky-900",
  quotation_sent: "bg-violet-100 text-violet-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  completed: "bg-stone text-bark",
  rejected: "bg-red-100 text-red-900",
};

export function PrivateStatusBadge({ status }: { status: keyof typeof t.privateRequests.statuses }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", PRIVATE_BADGE[status])}>
      {t.privateRequests.statuses[status]}
    </span>
  );
}

/** "12 Απρ 2027" for a calendar day (no timezone shift). */
export function formatDay(iso: string | null | undefined, time?: string | null): string {
  if (!iso) return "—";
  const d = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
  return time ? `${d} ${time.slice(0, 5)}` : d;
}

/** A run's dates: "Σάβ 6 Ιουν – Κυρ 7 Ιουν 2026" for multi-day runs, else formatDay(). */
export function formatRun(start: string | null | undefined, end?: string | null, time?: string | null): string {
  if (!start) return "—";
  if (!end || end <= start) return formatDay(start, time);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const first = new Intl.DateTimeFormat("el-GR", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" }).format(
    new Date(`${start}T00:00:00Z`),
  );
  return `${first}${time ? ` ${time.slice(0, 5)}` : ""} – ${formatDay(end)}`;
}

export function formatEurAdmin(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
}
