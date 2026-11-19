"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import type { PublicDeparture, PublicExcursion } from "@/lib/cms/types";
import {
  REQUEST_FORM_ID,
  bookingRequestSchema,
  type BookingRequestData,
  type BookingRequestInput,
  type SubmitError,
  type SubmitResponse,
} from "@/lib/bookings/validation";
import { formatDateLong, formatDateTime, formatEur } from "@/lib/bookings/format";
import { FormField, inputClass } from "@/components/forms/FormField";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Props = {
  excursion: Pick<PublicExcursion, "id" | "title" | "bookingMode" | "depositEur">;
  locale: Locale;
  t: Dictionary["booking"];
  privacyHref: string;
  contactHref: string;
  /** Admin preview: shows the real form but never submits. */
  preview?: boolean;
};

type Load = { kind: "loading" } | { kind: "ready"; departures: PublicDeparture[] } | { kind: "error" };
type Status =
  | { kind: "idle" }
  | { kind: "success"; reference: string; emailSent: boolean }
  | { kind: "error"; code: SubmitError | "network"; remaining?: number };

/**
 * The single customer action at the bottom of an experience page.
 * - Scheduled excursion (booking_mode "departures"): participation request for
 *   one departure, with live remaining places. Capacity is enforced again by
 *   the database; nothing is confirmed automatically and nothing is paid.
 * - General experience (booking_mode "interest"): inquiry with an optional
 *   preferred date / period. No departure, no capacity, no reservation.
 * The experience is attached automatically; the visitor never picks it again.
 */
export function ExperienceRequestForm({ excursion, locale, t, privacyHref, preview }: Props) {
  const scheduled = excursion.bookingMode === "departures";
  const f = t.form;
  const idPrefix = `request-${excursion.id.slice(0, 8)}`;
  const statusRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>(scheduled ? { kind: "loading" } : { kind: "ready", departures: [] });
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!scheduled) return;
    try {
      const res = await fetch(`/api/availability/${excursion.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { departures: PublicDeparture[] };
      setLoad({ kind: "ready", departures: body.departures });
    } catch {
      setLoad({ kind: "error" });
    }
  }, [excursion.id, scheduled]);

  useEffect(() => {
    // Live counts are fetched after hydration; the page itself stays cached.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BookingRequestInput, unknown, BookingRequestData>({
    resolver: zodResolver(bookingRequestSchema),
    mode: "onTouched",
    defaultValues: {
      excursionId: excursion.id,
      departureId: null,
      fullName: "",
      email: "",
      phone: "",
      participants: "1",
      preferredPeriod: "",
      message: "",
      consent: false,
      website: "",
      startedAt: 0,
      locale,
      idempotencyKey: "00000000-0000-4000-8000-000000000000",
    },
  });

  useEffect(() => {
    // Values that must only exist on the client.
    setValue("startedAt", Date.now());
    setValue("idempotencyKey", crypto.randomUUID());
  }, [setValue]);

  const departures = useMemo(() => (load.kind === "ready" ? load.departures : []), [load]);
  const open = useMemo(() => departures.filter((d) => d.state === "open"), [departures]);
  const onlyOpenId = open.length === 1 ? open[0].id : null;
  // Scheduled excursion with no open departure yet: the visitor can still register
  // interest (saved as an inquiry without a date) instead of being sent away.
  const noDates = scheduled && load.kind === "ready" && open.length === 0;
  const dated = scheduled && !noDates;

  // One open departure: select it for the visitor.
  useEffect(() => {
    if (scheduled && onlyOpenId) setValue("departureId", onlyOpenId);
  }, [scheduled, onlyOpenId, setValue]);

  const departureId = useWatch({ control, name: "departureId" });
  const participantsRaw = useWatch({ control, name: "participants" });
  const selected = useMemo(() => open.find((d) => d.id === departureId) ?? null, [open, departureId]);
  const people = Number(participantsRaw);
  const total = selected?.priceEur != null && Number.isInteger(people) && people > 0 ? selected.priceEur * people : null;

  useEffect(() => {
    if (status.kind !== "idle") statusRef.current?.focus();
  }, [status]);

  const msg = (code?: string) => {
    if (!code) return undefined;
    if (code.includes(" ")) return code; // already a sentence (e.g. tooMany)
    return (f.errors as Record<string, string>)[code] ?? f.errors.generic;
  };

  const onSubmit = async (data: BookingRequestData) => {
    if (dated && !data.departureId) {
      setError("departureId", { message: "departure" });
      return;
    }
    if (selected?.remaining != null && data.participants > selected.remaining) {
      setError("participants", { message: format(f.errors.tooMany, { count: selected.remaining }) });
      return;
    }
    if (preview) {
      setStatus({ kind: "error", code: "notConfigured" });
      return;
    }
    setStatus({ kind: "idle" });
    let res: Response;
    try {
      res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          departureId: dated ? data.departureId : null,
          preferredPeriod: dated ? undefined : data.preferredPeriod,
        }),
      });
    } catch {
      setStatus({ kind: "error", code: "network" });
      return;
    }
    let body: SubmitResponse | null = null;
    try {
      body = (await res.json()) as SubmitResponse;
    } catch {
      body = null;
    }
    if (body?.ok) {
      setStatus({ kind: "success", reference: body.reference, emailSent: body.emailSent });
      void refresh();
      return;
    }
    if (body && !body.ok) {
      for (const [field, code] of Object.entries(body.fields ?? {})) setError(field as keyof BookingRequestInput, { message: code });
      if (["capacity", "full", "departureClosed", "deadlinePassed"].includes(body.error)) void refresh();
      setStatus({ kind: "error", code: body.error, remaining: body.remaining });
    } else {
      setStatus({ kind: "error", code: "generic" });
    }
  };

  const errorText = (s: Extract<Status, { kind: "error" }>) =>
    s.code === "capacity" ? format(f.errors.capacity, { count: s.remaining ?? 0 }) : (f.errors as Record<string, string>)[s.code] ?? f.errors.generic;

  const field = (name: keyof BookingRequestInput) => ({
    id: `${idPrefix}-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": `${idPrefix}-${name}-error`,
  });

  const title = dated ? t.scheduledTitle : t.generalTitle;
  const intro = dated ? t.scheduledBody : t.generalBody;

  return (
    <div id={REQUEST_FORM_ID} className="on-light scroll-mt-28 rounded-sm bg-limestone p-6 text-ink sm:p-10">
      <p className="text-eyebrow text-bark">{excursion.title}</p>
      <h2 id={`${idPrefix}-title`} className="text-display-sm mt-2">
        {title}
      </h2>
      <p className="text-lead mt-4 max-w-2xl text-bark">{intro}</p>

      {status.kind === "success" ? (
        <div ref={statusRef} tabIndex={-1} role="status" className="mt-8 border-t border-ink/10 pt-8 outline-none">
          <CheckCircle2 aria-hidden className="size-10 text-[#2f6f5c]" strokeWidth={1.5} />
          <p className="text-lead mt-5 max-w-2xl">{dated ? t.scheduledSuccess : t.generalSuccess}</p>
          <p className="mt-8 text-sm text-bark">{f.reference}</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-wider">{status.reference}</p>
          {status.emailSent && <p className="mt-6 text-sm text-bark">{f.emailSent}</p>}
          <p className="mt-2 text-xs text-bark">{dated ? t.noPayment : t.noPaymentGeneral}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby={`${idPrefix}-title`} className="mt-8 border-t border-ink/10 pt-8">
          <p className="text-sm text-bark">{f.requiredNote}</p>
          {preview && <p className="mt-3 rounded-sm bg-sand/40 p-3 text-sm">{t.previewDisabled}</p>}
          {noDates && <p className="mt-3 text-sm text-bark">{t.noDeparturesInterest}</p>}

          {dated && (
            <fieldset className="mt-6">
              <legend className="mb-3 text-sm font-semibold">
                {f.departure} <span aria-hidden className="text-clay">*</span>
              </legend>
              {load.kind === "loading" && (
                <p role="status" className="text-sm text-bark">
                  {t.loading}
                </p>
              )}
              {load.kind === "error" && (
                <div role="alert" className="text-sm text-[#9a3b1f]">
                  {t.availabilityError}{" "}
                  <button type="button" className="underline underline-offset-4" onClick={() => void refresh()}>
                    {t.retry}
                  </button>
                </div>
              )}
              <div className="grid gap-2" aria-describedby={`${idPrefix}-departureId-error`}>
                {departures.map((d) => {
                  const isOpen = d.state === "open";
                  const note = locale === "el" ? d.noteEl || d.noteEn : d.noteEn || d.noteEl;
                  return (
                    <label
                      key={d.id}
                      className={cn(
                        "flex items-center justify-between gap-4 border border-ink/15 px-4 py-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
                        isOpen ? "cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink/[0.04]" : "cursor-not-allowed opacity-60",
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <input type="radio" value={d.id} disabled={!isOpen} {...register("departureId")} className="mt-1 size-4 accent-[#1e3530]" />
                        <span>
                          <span className="block font-semibold">
                            {formatDateLong(d.date, locale, d.time)}
                            {d.returnDate && d.returnDate !== d.date && <> – {formatDateLong(d.returnDate, locale)}</>}
                          </span>
                          <span className="block text-xs text-bark">
                            {isOpen
                              ? [
                                  d.remaining != null ? (d.remaining === 1 ? t.remainingOne : format(t.remaining, { count: d.remaining })) : null,
                                  d.returnTime ? format(t.returnAt, { time: d.returnTime.slice(0, 5) }) : null,
                                  d.deadline ? format(t.deadline, { date: formatDateTime(d.deadline, locale) }) : null,
                                  d.minParticipants ? format(t.minParticipants, { count: d.minParticipants }) : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")
                              : t.states[d.state]}
                          </span>
                          {note && <span className="block text-xs text-bark">{note}</span>}
                        </span>
                      </span>
                      {d.priceEur != null && (
                        <span className="shrink-0 text-right text-sm font-semibold">
                          {formatEur(d.priceEur, locale)}
                          <span className="block text-xs font-normal text-bark">{t.perPerson}</span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <p id={`${idPrefix}-departureId-error`} role={errors.departureId ? "alert" : undefined} className={errors.departureId ? "mt-2 text-sm text-[#9a3b1f]" : "sr-only"}>
                {msg(errors.departureId?.message)}
              </p>
            </fieldset>
          )}

          <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <FormField id={`${idPrefix}-fullName`} label={f.fullName} required error={msg(errors.fullName?.message)} className="sm:col-span-2">
              <input {...register("fullName")} {...field("fullName")} autoComplete="name" aria-required className={inputClass} />
            </FormField>
            <FormField id={`${idPrefix}-email`} label={f.email} required error={msg(errors.email?.message)}>
              <input {...register("email")} {...field("email")} type="email" inputMode="email" autoComplete="email" aria-required className={inputClass} />
            </FormField>
            <FormField id={`${idPrefix}-phone`} label={f.phone} required error={msg(errors.phone?.message)}>
              <input {...register("phone")} {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" aria-required className={inputClass} />
            </FormField>
            {!dated && (
              <FormField id={`${idPrefix}-preferredPeriod`} label={f.preferredPeriod} optionalLabel={f.optional} error={msg(errors.preferredPeriod?.message)}>
                <input {...register("preferredPeriod")} {...field("preferredPeriod")} placeholder={f.preferredPeriodPlaceholder} maxLength={200} className={inputClass} />
              </FormField>
            )}
            <FormField
              id={`${idPrefix}-participants`}
              label={dated ? f.participants : f.participantsGeneral}
              required
              error={msg(errors.participants?.message)}
            >
              <input
                {...register("participants")}
                {...field("participants")}
                type="number"
                inputMode="numeric"
                min={1}
                max={selected?.remaining ?? 100}
                aria-required
                className={inputClass}
              />
            </FormField>
            {dated && (
              <div className="flex flex-col justify-end pb-6 text-sm text-bark" aria-live="polite">
                {selected?.remaining != null && <span>{format(f.participantsHint, { count: selected.remaining })}</span>}
              </div>
            )}

            {dated && selected?.priceEur != null && (
              <div className="border border-ink/10 bg-white/60 p-4 sm:col-span-2" aria-live="polite">
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-bark">{f.pricePerPerson}</dt>
                  <dd className="text-right">{formatEur(selected.priceEur, locale)}</dd>
                  {(selected.depositEur ?? excursion.depositEur) != null && (
                    <>
                      <dt className="text-bark">{f.depositPerPerson}</dt>
                      <dd className="text-right">{formatEur((selected.depositEur ?? excursion.depositEur) as number, locale)}</dd>
                    </>
                  )}
                  <dt className="font-semibold">{f.total}</dt>
                  <dd className="text-right text-lg font-semibold">{total != null ? formatEur(total, locale) : "—"}</dd>
                </dl>
                <p className="mt-2 text-xs text-bark">{f.totalNote}</p>
              </div>
            )}

            <FormField
              id={`${idPrefix}-message`}
              label={dated ? f.additionalInfo : f.messageQuestions}
              optionalLabel={f.optional}
              error={msg(errors.message?.message)}
              className="sm:col-span-2"
            >
              <textarea {...register("message")} {...field("message")} rows={4} maxLength={3000} className={`${inputClass} resize-y`} />
            </FormField>
          </div>

          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={`${idPrefix}-website`}>{f.honeypot}</label>
            <input {...register("website")} id={`${idPrefix}-website`} type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <p className="mt-2 text-xs leading-relaxed text-bark">{f.privacy}</p>
          <div className="mt-4 flex items-start gap-3">
            <input {...register("consent")} {...field("consent")} type="checkbox" aria-required className="mt-1 size-5 shrink-0 accent-[#1e3530]" />
            <label htmlFor={`${idPrefix}-consent`} className="text-sm leading-relaxed text-bark">
              {f.consent}{" "}
              <Link href={privacyHref} target="_blank" className="font-semibold text-ink underline underline-offset-4">
                {f.consentLink}
              </Link>
              . <span aria-hidden className="text-clay">*</span>
            </label>
          </div>
          <p id={`${idPrefix}-consent-error`} role={errors.consent ? "alert" : undefined} className={errors.consent ? "mt-2 text-sm text-[#9a3b1f]" : "sr-only"}>
            {msg(errors.consent?.message)}
          </p>

          {status.kind === "error" && (
            <div ref={statusRef} tabIndex={-1} role="alert" className="mt-6 flex gap-3 border-l-2 border-[#9a3b1f] bg-[#9a3b1f]/[0.06] p-4 text-sm outline-none">
              <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-[#9a3b1f]" />
              <div>
                <p className="font-semibold">{f.errorTitle}</p>
                <p className="mt-1 text-bark">{errorText(status)}</p>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-xs text-bark">{dated ? t.noPayment : t.noPaymentGeneral}</p>
            <Button type="submit" disabled={isSubmitting || (scheduled && load.kind !== "ready")} aria-busy={isSubmitting} className="!bg-ink !text-bone">
              {isSubmitting ? f.sending : dated ? f.submitScheduled : f.submitGeneral}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
