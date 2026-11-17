"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePrivateProposal, setPrivateRequestStatus } from "../_actions/bookings";
import { errorMessage, t } from "../_lib/strings";
import { PRIVATE_STATUSES, type PrivateStatus } from "@/lib/bookings/validation";
import { useToast } from "./Toast";
import { Field } from "./Field";
import { Btn, Card } from "./ui";

const P = t.privateRequests;

export function PrivateStatusControl({ id, status }: { id: string; status: PrivateStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [next, setNext] = useState<PrivateStatus>(status);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setPrivateRequestStatus({ id, status: next, note });
          if (!res.ok) {
            toast("error", t.common.error);
            return;
          }
          setNote("");
          toast("success", t.bookings.statusChanged);
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <Field id="pr-status" label={P.statusLabel}>
        <select id="pr-status" value={next} onChange={(e) => setNext(e.target.value as PrivateStatus)} className="admin-input">
          {PRIVATE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {P.statuses[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="pr-note" label={P.statusNote} optional>
        <textarea id="pr-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} className="admin-input" />
      </Field>
      <Btn type="submit" disabled={pending || next === status} className="w-full">
        {pending ? t.common.saving : P.updateStatus}
      </Btn>
    </form>
  );
}

export function ProposalForm({
  id,
  initial,
}: {
  id: string;
  initial: { proposal_itinerary: string | null; proposal_dates: string | null; proposal_price_eur: string | number | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    proposal_itinerary: initial.proposal_itinerary ?? "",
    proposal_dates: initial.proposal_dates ?? "",
    proposal_price_eur: initial.proposal_price_eur == null ? "" : String(initial.proposal_price_eur),
  });
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="text-lg font-semibold">{P.proposal}</h2>
      <p className="mb-4 text-xs text-bark">{P.proposalHint}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await savePrivateProposal({ id, ...form });
            if (!res.ok) {
              toast("error", errorMessage(res.error) ?? t.common.error);
              return;
            }
            toast("success", t.common.saved);
            router.refresh();
          });
        }}
        className="grid gap-4"
      >
        <Field id="pp-itinerary" label={P.itinerary} optional>
          <textarea id="pp-itinerary" value={form.proposal_itinerary} onChange={(e) => setForm({ ...form, proposal_itinerary: e.target.value })} rows={6} className="admin-input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pp-dates" label={P.proposalDates} optional>
            <input id="pp-dates" value={form.proposal_dates} onChange={(e) => setForm({ ...form, proposal_dates: e.target.value })} className="admin-input" />
          </Field>
          <Field id="pp-price" label={P.proposalPrice} optional>
            <input id="pp-price" inputMode="decimal" value={form.proposal_price_eur} onChange={(e) => setForm({ ...form, proposal_price_eur: e.target.value })} className="admin-input" />
          </Field>
        </div>
        <Btn type="submit" variant="secondary" disabled={pending} className="justify-self-start">
          {pending ? t.common.saving : P.saveProposal}
        </Btn>
      </form>
    </Card>
  );
}
