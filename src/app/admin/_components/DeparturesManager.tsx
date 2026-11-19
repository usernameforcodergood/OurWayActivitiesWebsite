"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, Copy, Pencil, Trash2 } from "lucide-react";
import type { DepartureRow } from "@/lib/cms/types";
import type { DepartureInput } from "@/lib/cms/schemas";
import { deleteDeparture, saveDeparture } from "../_actions/departures";
import { errorMessage, fmt, t } from "../_lib/strings";
import { isoToAthensInput } from "../_lib/athens-time";
import { useToast } from "./Toast";
import { Field } from "./Field";
import { ConfirmDialog } from "./ConfirmDialog";
import { Btn, Card, formatDay, formatEurAdmin } from "./ui";

type Stats = { confirmed: number; pending_held: number; pending_expired: number };
type Row = DepartureRow & { stats: Stats };

const D = t.departures;

type FormState = {
  id?: string;
  /** Repeat: the run the settings were copied from (shown in the dialog). */
  copiedFrom?: string;
  /** Repeat of a multi-day run: keep the same length when the start date changes. */
  spanDays?: number;
  departure_date: string;
  return_date: string;
  departure_time: string;
  return_time: string;
  price_eur: string;
  deposit_eur: string;
  capacity: string;
  min_participants: string;
  booking_deadline: string;
  status: DepartureRow["status"];
  note_el: string;
  note_en: string;
};

const empty: FormState = {
  departure_date: "",
  return_date: "",
  departure_time: "",
  return_time: "",
  price_eur: "",
  deposit_eur: "",
  capacity: "",
  min_participants: "",
  booking_deadline: "",
  status: "open",
  note_el: "",
  note_en: "",
};

const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));

function fromRow(r: Row): FormState {
  return {
    id: r.id,
    departure_date: r.departure_date,
    return_date: r.return_date ?? "",
    departure_time: r.departure_time?.slice(0, 5) ?? "",
    return_time: r.return_time?.slice(0, 5) ?? "",
    price_eur: str(r.price_eur),
    deposit_eur: str(r.deposit_eur),
    capacity: str(r.capacity),
    min_participants: str(r.min_participants),
    booking_deadline: isoToAthensInput(r.booking_deadline),
    status: r.status,
    note_el: r.note_el ?? "",
    note_en: r.note_en ?? "",
  };
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Repeat: copy everything that belongs to a run, except its dates, deadline and status. */
function repeatOf(r: Row, newDate = ""): FormState {
  const span = r.return_date ? daysBetween(r.departure_date, r.return_date) : undefined;
  return {
    ...fromRow(r),
    id: undefined,
    copiedFrom: r.departure_date,
    spanDays: span,
    departure_date: newDate,
    return_date: newDate && span != null ? addDays(newDate, span) : "",
    booking_deadline: "",
    status: "open",
  };
}

const STATUS_CLS: Record<DepartureRow["status"], string> = {
  open: "bg-emerald-100 text-emerald-900",
  full: "bg-amber-100 text-amber-900",
  cancelled: "bg-red-100 text-red-900",
  completed: "bg-stone text-bark",
};

export type OpenRequest = { newDate?: string; repeatId?: string; focusId?: string };

/**
 * Scheduled runs of one excursion. The excursion's content is shared; every
 * run has its own dates, price, deposit, places and requests.
 */
export function DeparturesManager({
  excursionId,
  rows,
  defaultPrice,
  defaultDeposit,
  today,
  open,
}: {
  excursionId: string;
  rows: Row[];
  defaultPrice: number | null;
  defaultDeposit: number | null;
  /** Athens date (YYYY-MM-DD): runs starting on/before it are history. */
  today: string;
  /** From the URL (?newDate=… / ?repeat=… / ?departure=…), e.g. from the dashboard calendar. */
  open?: OpenRequest;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const handledOpen = useRef(false);

  const isHistory = (r: Row) => r.status === "completed" || r.status === "cancelled" || r.departure_date <= today;
  const upcoming = rows.filter((r) => !isHistory(r));
  const history = rows.filter(isHistory).reverse();
  const latest = rows.length ? rows.reduce((a, b) => (b.departure_date > a.departure_date ? b : a)) : null;

  // Open the dialog requested by the URL once, then drop the query so a refresh doesn't reopen it.
  useEffect(() => {
    if (handledOpen.current || !open) return;
    handledOpen.current = true;
    const source = open.repeatId ? rows.find((r) => r.id === open.repeatId) : null;
    if (open.focusId) {
      // After layout/scroll restoration, so the row actually ends up in view.
      const id = `dep-${open.focusId}`;
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
    } else if (source) {
      setEditing(repeatOf(source, open.newDate ?? ""));
    } else if (open.newDate !== undefined) {
      setEditing(latest ? repeatOf(latest, open.newDate) : { ...empty, departure_date: open.newDate });
    }
    if (!open.focusId) router.replace(pathname, { scroll: false });
  }, [open, rows, latest, router, pathname]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (editing && !d.open) d.showModal();
    if (!editing && d.open) d.close();
  }, [editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setEditing((f) => {
      if (!f) return f;
      const next = { ...f, [k]: v };
      // Repeat of a multi-day run: move the end date along with the start date.
      if (k === "departure_date" && f.spanDays != null && typeof v === "string" && v) next.return_date = addDays(v, f.spanDays);
      if (k === "return_date") next.spanDays = undefined;
      return next;
    });
    setErrors((e) => {
      if (!e[k as string]) return e;
      const rest = { ...e };
      delete rest[k as string];
      return rest;
    });
  };

  const errText = (k: string) => {
    const code = errors[k];
    if (!code) return undefined;
    const held = /^capacityBelowHeld:(\d+)$/.exec(code);
    if (held) return fmt(D.capacityBelowHeld, { count: held[1] });
    return errorMessage(code);
  };

  const submit = () => {
    if (!editing) return;
    const payload: DepartureInput = {
      id: editing.id,
      excursion_id: excursionId,
      departure_date: editing.departure_date,
      return_date: editing.return_date || null,
      departure_time: editing.departure_time || null,
      return_time: editing.return_time || null,
      price_eur: editing.price_eur.trim() || null,
      deposit_eur: editing.deposit_eur.trim() || null,
      capacity: editing.capacity.trim() || null,
      min_participants: editing.min_participants.trim() || null,
      booking_deadline: editing.booking_deadline || null,
      status: editing.status,
      note_el: editing.note_el,
      note_en: editing.note_en,
    };
    start(async () => {
      const res = await saveDeparture(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        const first = Object.values(res.fieldErrors ?? {})[0];
        toast("error", first?.startsWith("capacityBelowHeld") ? fmt(D.capacityBelowHeld, { count: first.split(":")[1] }) : (errorMessage(first ?? res.error) ?? t.common.error));
        return;
      }
      toast("success", D.saved);
      setEditing(null);
      setErrors({});
      router.refresh();
    });
  };

  const editingRow = editing?.id ? rows.find((r) => r.id === editing.id) : undefined;
  const activeOnEditing = editingRow ? editingRow.stats.confirmed + editingRow.stats.pending_held + editingRow.stats.pending_expired : 0;

  const table = (list: Row[]) => (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="border-y border-ink/10 text-xs uppercase tracking-wide text-bark">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-semibold sm:px-6">{D.date}</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">{D.price}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">{D.confirmed}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">{D.pending}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">{D.free}</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">{D.status}</th>
            <th scope="col" className="px-5 py-2.5 sm:px-6">
              <span className="sr-only">{t.common.edit}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/8">
          {list.map((r) => {
            const held = r.stats.confirmed + r.stats.pending_held;
            const free = r.capacity == null ? null : Math.max(r.capacity - held, 0);
            const price = r.price_eur ?? defaultPrice;
            const deposit = r.deposit_eur ?? defaultDeposit;
            const focused = open?.focusId === r.id;
            return (
              <tr key={r.id} id={`dep-${r.id}`} className={`scroll-mt-24 ${focused ? "bg-amber-50" : ""}`}>
                <td className="whitespace-nowrap px-5 py-3 sm:px-6">
                  <span className="font-medium">{formatDay(r.departure_date, r.departure_time)}</span>
                  {r.return_date && r.return_date !== r.departure_date && <span className="block text-xs text-bark">→ {formatDay(r.return_date, r.return_time)}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {formatEurAdmin(price)}
                  {r.price_eur == null && price != null && <span className="text-xs text-bark"> *</span>}
                  {deposit != null && <span className="block text-xs text-bark">{D.deposit.replace(" (€)", "")}: {formatEurAdmin(deposit)}</span>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{r.stats.confirmed}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {r.stats.pending_held}
                  {r.stats.pending_expired > 0 && <span className="text-xs text-bark"> (+{r.stats.pending_expired})</span>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {free == null ? <span className="text-xs text-bark">{D.unlimited}</span> : `${free} / ${r.capacity}`}
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[r.status]}`}>{D.statuses[r.status]}</span>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right sm:px-6">
                  <Link href={`/admin/bookings?excursion=${excursionId}&from=${r.departure_date}&to=${r.departure_date}&sort=departure`} className="mr-1 inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-lagoon hover:bg-lagoon/5">
                    {D.viewBookings}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setEditing(repeatOf(r));
                    }}
                    className="mr-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-lagoon hover:bg-lagoon/5"
                  >
                    <Copy aria-hidden className="size-3.5" />
                    {D.repeat}
                    <span className="sr-only"> {formatDay(r.departure_date)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setEditing(fromRow(r));
                    }}
                    aria-label={`${D.edit} ${formatDay(r.departure_date)}`}
                    className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-ink/5"
                  >
                    <Pencil aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(r)}
                    aria-label={`${t.common.delete} ${formatDay(r.departure_date)}`}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <Card>
      <div id="departures" className="mb-2 flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{D.title}</h2>
        <Btn
          onClick={() => {
            setErrors({});
            setEditing(latest ? repeatOf(latest) : { ...empty });
          }}
        >
          <CalendarPlus aria-hidden className="size-4" />
          {D.add}
        </Btn>
      </div>
      <p className="mb-5 text-xs text-bark">{D.intro}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-bark">{D.empty}</p>
      ) : (
        <>
          <h3 className="mb-2 text-sm font-semibold">
            {D.upcoming} ({upcoming.length})
          </h3>
          {upcoming.length ? table(upcoming) : <p className="text-sm text-bark">—</p>}
          {history.length > 0 && (
            <details className="mt-6" open={Boolean(open?.focusId && history.some((r) => r.id === open.focusId))}>
              <summary className="cursor-pointer text-sm font-semibold">
                {D.history} ({history.length})
              </summary>
              <div className="mt-2">{table(history)}</div>
            </details>
          )}
        </>
      )}

      <dialog ref={dialog} onClose={() => setEditing(null)} aria-labelledby="dep-title" className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl">
        {editing && (
          <form
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <h2 id="dep-title" className="mb-2 text-lg font-semibold">
              {editing.id ? D.edit : editing.copiedFrom ? D.repeatTitle : D.add}
            </h2>
            {editing.copiedFrom && <p className="mb-5 rounded-lg bg-lagoon/5 p-3 text-xs text-ink">{fmt(D.repeatFrom, { date: formatDay(editing.copiedFrom) })}</p>}
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field id="dep-date" label={D.date} error={errText("departure_date")}>
                <input id="dep-date" type="date" required value={editing.departure_date} onChange={(e) => set("departure_date", e.target.value)} className="admin-input" />
              </Field>
              <Field id="dep-time" label={D.time} optional error={errText("departure_time")}>
                <input id="dep-time" type="time" value={editing.departure_time} onChange={(e) => set("departure_time", e.target.value)} className="admin-input" />
              </Field>
              <Field id="dep-return-date" label={D.returnDate} hint={D.returnDateHint} optional error={errText("return_date")}>
                <input id="dep-return-date" type="date" min={editing.departure_date || undefined} value={editing.return_date} onChange={(e) => set("return_date", e.target.value)} className="admin-input" />
              </Field>
              <Field id="dep-return" label={D.returnTime} optional error={errText("return_time")}>
                <input id="dep-return" type="time" value={editing.return_time} onChange={(e) => set("return_time", e.target.value)} className="admin-input" />
              </Field>
              <Field id="dep-price" label={D.price} hint={D.priceHint} optional error={errText("price_eur")}>
                <input id="dep-price" inputMode="decimal" value={editing.price_eur} onChange={(e) => set("price_eur", e.target.value)} placeholder={defaultPrice != null ? String(defaultPrice) : ""} className="admin-input" />
              </Field>
              <Field id="dep-deposit" label={D.deposit} hint={D.depositHint} optional error={errText("deposit_eur")}>
                <input id="dep-deposit" inputMode="decimal" value={editing.deposit_eur} onChange={(e) => set("deposit_eur", e.target.value)} placeholder={defaultDeposit != null ? String(defaultDeposit) : ""} className="admin-input" />
              </Field>
              <Field id="dep-capacity" label={D.capacity} hint={D.capacityHint} optional error={errText("capacity")}>
                <input id="dep-capacity" inputMode="numeric" value={editing.capacity} onChange={(e) => set("capacity", e.target.value)} className="admin-input" />
              </Field>
              <Field id="dep-min" label={D.minParticipants} optional error={errText("min_participants")}>
                <input id="dep-min" inputMode="numeric" value={editing.min_participants} onChange={(e) => set("min_participants", e.target.value)} className="admin-input" />
              </Field>
              <Field id="dep-status" label={D.status}>
                <select id="dep-status" value={editing.status} onChange={(e) => set("status", e.target.value as FormState["status"])} className="admin-input">
                  {(["open", "full", "cancelled", "completed"] as const).map((s) => (
                    <option key={s} value={s}>
                      {D.statuses[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="dep-deadline" label={D.deadline} hint={D.deadlineHint} optional error={errText("booking_deadline")} className="sm:col-span-3">
                <input id="dep-deadline" type="datetime-local" value={editing.booking_deadline} onChange={(e) => set("booking_deadline", e.target.value)} className="admin-input sm:max-w-xs" />
              </Field>
              <Field id="dep-note-el" label={D.noteEl} optional className="sm:col-span-3">
                <input id="dep-note-el" value={editing.note_el} maxLength={400} onChange={(e) => set("note_el", e.target.value)} className="admin-input" />
              </Field>
              <Field id="dep-note-en" label={D.noteEn} optional className="sm:col-span-3">
                <input id="dep-note-en" value={editing.note_en} maxLength={400} onChange={(e) => set("note_en", e.target.value)} className="admin-input" />
              </Field>
            </div>
            {editing.status === "cancelled" && activeOnEditing > 0 && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{fmt(D.cancelWarning, { count: activeOnEditing })}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setEditing(null)} disabled={pending}>
                {t.common.cancel}
              </Btn>
              <Btn type="submit" variant="publish" disabled={pending || !editing.departure_date}>
                {pending ? t.common.saving : D.save}
              </Btn>
            </div>
          </form>
        )}
      </dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={D.deleteTitle}
        body={fmt(D.deleteBody, { date: toDelete ? formatDay(toDelete.departure_date) : "" })}
        busy={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          setDeleting(true);
          const res = await deleteDeparture(toDelete.id);
          setDeleting(false);
          setToDelete(null);
          if (!res.ok) {
            toast("error", errorMessage(res.error) ?? t.common.error);
            return;
          }
          toast("success", D.deleted);
          router.refresh();
        }}
      />
    </Card>
  );
}
