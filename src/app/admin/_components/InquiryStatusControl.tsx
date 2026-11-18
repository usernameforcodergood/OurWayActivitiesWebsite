"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInquiryStatus } from "../_actions/bookings";
import { t } from "../_lib/strings";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/lib/bookings/validation";
import { useToast } from "./Toast";
import { Field } from "./Field";
import { Btn } from "./ui";

const B = t.bookings;

/** Status of a general-experience inquiry (no capacity, no confirmation, no customer email). */
export function InquiryStatusControl({ id, status }: { id: string; status: InquiryStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [next, setNext] = useState<InquiryStatus>(status);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setInquiryStatus({ id, status: next, note });
          if (!res.ok) {
            toast("error", t.common.error);
            return;
          }
          setNote("");
          toast("success", B.statusChanged);
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-950">{B.inquiryHint}</p>
      <Field id="inq-status" label={B.inquiryStatus}>
        <select id="inq-status" value={next} onChange={(e) => setNext(e.target.value as InquiryStatus)} className="admin-input">
          {INQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {B.statuses[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="inq-note" label={B.inquiryNote} optional>
        <textarea id="inq-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className="admin-input" />
      </Field>
      <Btn type="submit" disabled={pending || next === status} className="w-full">
        {pending ? t.common.saving : B.inquirySave}
      </Btn>
    </form>
  );
}
