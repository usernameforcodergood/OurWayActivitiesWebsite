"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; kind: "success" | "error"; message: string };
const Ctx = createContext<(kind: Toast["kind"], message: string) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

/** Success / error messages announced to screen readers. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, kind, message }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4500);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
        {toasts.map((x) => (
          <div
            key={x.id}
            role={x.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl p-4 text-sm shadow-lg ring-1",
              x.kind === "success" ? "bg-white text-ink ring-emerald-600/20" : "bg-white text-ink ring-red-600/30",
            )}
          >
            {x.kind === "success" ? (
              <CheckCircle2 aria-hidden className="size-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle aria-hidden className="size-5 shrink-0 text-red-600" />
            )}
            <p className="flex-1">{x.message}</p>
            <button
              type="button"
              onClick={() => setToasts((list) => list.filter((y) => y.id !== x.id))}
              className="-m-1 rounded p-1 text-ink/50 hover:text-ink"
              aria-label="×"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
