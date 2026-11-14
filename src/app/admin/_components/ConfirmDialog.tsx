"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Btn } from "./ui";
import { t } from "../_lib/strings";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Native <dialog>: focus trap, Escape to close and backdrop come for free. */
export function ConfirmDialog({ open, title, body, confirmLabel = t.common.delete, busy, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl"
    >
      <div className="p-6">
        <div className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertTriangle aria-hidden className="size-5" />
          </span>
          <div>
            <h2 id="confirm-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-2 text-sm text-bark">{body}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose} disabled={busy} autoFocus>
            {t.common.cancel}
          </Btn>
          <Btn variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? t.common.deleting : confirmLabel}
          </Btn>
        </div>
      </div>
    </dialog>
  );
}
