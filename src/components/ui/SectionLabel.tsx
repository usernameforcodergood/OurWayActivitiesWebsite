import { cn } from "@/lib/utils";

/** Editorial section marker: "(02) — Label". */
export function SectionLabel({
  index,
  children,
  className,
}: {
  index?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-eyebrow flex items-center gap-3 text-current/70", className)}>
      {index && <span className="tabular-nums">({index})</span>}
      <span aria-hidden className="h-px w-8 bg-current/40" />
      <span>{children}</span>
    </p>
  );
}
