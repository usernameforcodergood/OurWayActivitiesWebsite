"use client";

import { ArrowUp } from "lucide-react";
import { scrollToTarget } from "./SmoothScroll";

export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        scrollToTarget(0);
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
      className="inline-flex min-h-10 items-center gap-2 hover:text-bone"
    >
      {label}
      <ArrowUp aria-hidden className="size-3.5" />
    </button>
  );
}
