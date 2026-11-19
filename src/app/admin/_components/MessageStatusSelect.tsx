"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMessageStatus } from "../_actions/messages";
import { fmt, t } from "../_lib/strings";
import { useToast } from "./Toast";

type Status = "new" | "in_progress" | "closed";
const M = t.messages;

/** Inline status change for one contact message. */
export function MessageStatusSelect({ id, reference, status }: { id: string; reference: string; status: Status }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState<Status>(status);
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={fmt(M.changeStatus, { ref: reference })}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Status;
        const prev = value;
        setValue(next);
        start(async () => {
          const res = await setMessageStatus({ id, status: next });
          if (!res.ok) {
            setValue(prev);
            toast("error", t.common.error);
            return;
          }
          toast("success", t.bookings.statusChanged);
          router.refresh();
        });
      }}
      className="admin-input min-h-9 py-1 text-xs"
    >
      {(Object.keys(M.statuses) as Status[]).map((s) => (
        <option key={s} value={s}>
          {M.statuses[s]}
        </option>
      ))}
    </select>
  );
}
