"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  deleteTailorMadeRequest,
  savePrivateProposal,
  setPrivateRequestStatus,
  updateTailorMadeRequest,
  type TailorMadeDetailsInput,
} from "../_actions/bookings";
import { errorMessage, fmt, t } from "../_lib/strings";
import type { PrivateRequestRow } from "../_lib/booking-queries";
import { EXPERIENCE_TYPES, MAX_GROUP, PRIVATE_STATUSES, type PrivateStatus } from "@/lib/bookings/validation";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";
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

type Details = Omit<TailorMadeDetailsInput, "id" | "participants"> & { participants: string };

function toForm(r: PrivateRequestRow): Details {
  return {
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    phone: r.phone,
    participants: String(r.participants),
    destination: r.destination ?? "",
    experience_type: r.experience_type ?? "",
    date_from: r.date_from ?? "",
    date_to: r.date_to ?? "",
    dates_flexible: r.dates_flexible,
    budget_per_person: r.budget_per_person ?? "",
    message: r.message ?? "",
    additional_requirements: r.additional_requirements ?? "",
  };
}

/** Lets an admin correct what the customer submitted. */
export function TailorMadeDetailsForm({ request }: { request: PrivateRequestRow }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Details>(() => toForm(request));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k: keyof Details) => {
    const code = errors[k];
    return code ? ((P.fieldErrors as Record<string, string>)[code] ?? t.common.error) : undefined;
  };
  const a11y = (k: keyof Details) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `td-${k}-error` : undefined });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateTailorMadeRequest({ id: request.id, ...form });
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            toast("error", res.fieldErrors ? P.fixErrors : t.common.error);
            return;
          }
          setErrors({});
          toast("success", t.common.saved);
          router.refresh();
        });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="td-first_name" label={P.firstName} error={err("first_name")}>
          <input id="td-first_name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} maxLength={80} className="admin-input" {...a11y("first_name")} />
        </Field>
        <Field id="td-last_name" label={P.lastName} error={err("last_name")}>
          <input id="td-last_name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} maxLength={80} className="admin-input" {...a11y("last_name")} />
        </Field>
        <Field id="td-email" label={P.email} error={err("email")}>
          <input id="td-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="admin-input" {...a11y("email")} />
        </Field>
        <Field id="td-phone" label={P.phone} error={err("phone")}>
          <input id="td-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="admin-input" {...a11y("phone")} />
        </Field>
        <Field id="td-experience_type" label={P.category} optional error={err("experience_type")}>
          <select id="td-experience_type" value={form.experience_type ?? ""} onChange={(e) => set("experience_type", e.target.value as Details["experience_type"])} className="admin-input">
            <option value="">—</option>
            {EXPERIENCE_TYPES.map((x) => (
              <option key={x} value={x}>
                {P.types[x]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="td-participants" label={P.participants} error={err("participants")}>
          <input id="td-participants" type="number" min={1} max={MAX_GROUP} inputMode="numeric" value={form.participants} onChange={(e) => set("participants", e.target.value)} className="admin-input" {...a11y("participants")} />
        </Field>
        <Field id="td-destination" label={P.destination} optional error={err("destination")} className="sm:col-span-2">
          <input id="td-destination" value={form.destination ?? ""} onChange={(e) => set("destination", e.target.value)} maxLength={300} className="admin-input" />
        </Field>
        <Field id="td-date_from" label={P.dateFrom} optional error={err("date_from")}>
          <input id="td-date_from" type="date" value={form.date_from ?? ""} onChange={(e) => set("date_from", e.target.value)} className="admin-input" {...a11y("date_from")} />
        </Field>
        <Field id="td-date_to" label={P.dateTo} optional error={err("date_to")}>
          <input id="td-date_to" type="date" value={form.date_to ?? ""} onChange={(e) => set("date_to", e.target.value)} className="admin-input" {...a11y("date_to")} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.dates_flexible} onChange={(e) => set("dates_flexible", e.target.checked)} className="size-4 accent-[#12211d]" />
          {P.datesFlexible}
        </label>
        <Field id="td-budget" label={P.budget} optional error={err("budget_per_person")} className="sm:col-span-2">
          <input id="td-budget" value={form.budget_per_person ?? ""} onChange={(e) => set("budget_per_person", e.target.value)} maxLength={120} className="admin-input" />
        </Field>
        <Field id="td-message" label={P.description} optional error={err("message")} className="sm:col-span-2">
          <textarea id="td-message" value={form.message ?? ""} onChange={(e) => set("message", e.target.value)} rows={5} maxLength={3000} className="admin-input" />
        </Field>
        <Field id="td-additional" label={P.additional} optional error={err("additional_requirements")} className="sm:col-span-2">
          <textarea id="td-additional" value={form.additional_requirements ?? ""} onChange={(e) => set("additional_requirements", e.target.value)} rows={3} maxLength={2000} className="admin-input" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" disabled={pending}>
          {pending ? t.common.saving : P.saveDetails}
        </Btn>
        <Btn
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setForm(toForm(request));
            setErrors({});
          }}
        >
          {t.common.cancel}
        </Btn>
      </div>
    </form>
  );
}

export function DeleteTailorMadeButton({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Btn variant="secondary" onClick={() => setOpen(true)} className="w-full !text-red-700">
        <Trash2 aria-hidden className="size-4" /> {P.deleteRequest}
      </Btn>
      <p className="mt-2 text-xs text-bark">{P.deleteHint}</p>
      <ConfirmDialog
        open={open}
        title={P.deleteTitle}
        body={fmt(P.deleteBody, { ref: reference })}
        busy={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deleteTailorMadeRequest(id);
            if (!res.ok) {
              toast("error", t.common.error);
              return;
            }
            toast("success", t.common.deleted);
            router.replace("/admin/tailor-made");
            router.refresh();
          })
        }
      />
    </>
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
