"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import type { PublicDeparture, PublicExcursion } from "@/lib/cms/types";
import {
  bookingRequestSchema,
  type BookingRequestData,
  type BookingRequestInput,
  type SubmitError,
  type SubmitResponse,
} from "@/lib/bookings/validation";
import { formatDateLong, formatEur } from "@/lib/bookings/format";
import { FormField, inputClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";

type Props = {
  mode: "departures" | "interest";
  excursion: Pick<PublicExcursion, "id" | "title">;
  /** Bookable departures with live counts (empty for interest). */
  departures: PublicDeparture[];
  initialDepartureId: string | null;
  locale: Locale;
  t: Dictionary["booking"];
  privacyHref: string;
  preview?: boolean;
  onClose: () => void;
  onAvailabilityChanged: () => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "success"; reference: string; emailSent: boolean }
  | { kind: "error"; code: SubmitError | "network"; remaining?: number };

/**
 * Booking request / expression-of-interest form in a modal. Validates with
 * the same schema as the server; the server and database decide. Shows
 * success only after the request is saved, and never claims confirmation.
 */
export function BookingDialog({
  mode,
  excursion,
  departures,
  initialDepartureId,
  locale,
  t,
  privacyHref,
  preview,
  onClose,
  onAvailabilityChanged,
}: Props) {
  const f = t.form;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const idPrefix = `booking-${excursion.id.slice(0, 8)}`;

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
      departureId: initialDepartureId,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      participants: "1",
      message: "",
      specialRequests: "",
      consent: false,
      website: "",
      startedAt: 0,
      locale,
      idempotencyKey: "00000000-0000-4000-8000-000000000000",
    },
  });

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    // Values that must only exist on the client.
    setValue("startedAt", Date.now());
    setValue("idempotencyKey", crypto.randomUUID());
  }, [setValue]);

  const departureId = useWatch({ control, name: "departureId" });
  const participantsRaw = useWatch({ control, name: "participants" });
  const selected = useMemo(() => departures.find((d) => d.id === departureId) ?? null, [departures, departureId]);
  const people = Number(participantsRaw);
  const validPeople = Number.isInteger(people) && people > 0;
  const maxPeople = selected?.remaining ?? 100;
  const total = selected?.priceEur != null && validPeople ? selected.priceEur * people : null;

  useEffect(() => {
    if (status.kind !== "idle") statusRef.current?.focus();
  }, [status]);

  const msg = (code?: string) => {
    if (!code) return undefined;
    if (code === "departure") return f.errors.departure;
    return (f.errors as Record<string, string>)[code] ?? f.errors.generic;
  };

  const onSubmit = async (data: BookingRequestData) => {
    if (mode === "departures" && !data.departureId) {
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
        body: JSON.stringify({ ...data, departureId: mode === "departures" ? data.departureId : null }),
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
      onAvailabilityChanged();
      return;
    }
    if (body && !body.ok) {
      for (const [field, code] of Object.entries(body.fields ?? {})) setError(field as keyof BookingRequestInput, { message: code });
      if (["capacity", "full", "departureClosed", "deadlinePassed"].includes(body.error)) onAvailabilityChanged();
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

  const close = () => {
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={`${idPrefix}-title`}
      className="on-light m-auto max-h-[calc(100dvh-1.5rem)] w-[min(40rem,calc(100vw-1.5rem))] overflow-hidden rounded-sm bg-limestone p-0 text-ink shadow-2xl backdrop:bg-ink/70"
    >
      <div data-lenis-prevent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink/10 bg-limestone px-6 py-5 sm:px-8">
          <div>
            <p className="text-eyebrow text-bark">{excursion.title}</p>
            <h2 id={`${idPrefix}-title`} className="text-display-sm mt-1">
              {mode === "interest" ? f.titleInterest : f.titleBooking}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label={f.close} className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5">
            <X aria-hidden className="size-5" />
          </button>
        </div>

        {status.kind === "success" ? (
          <div ref={statusRef} tabIndex={-1} role="status" className="px-6 py-10 outline-none sm:px-8">
            <CheckCircle2 aria-hidden className="size-10 text-[#2f6f5c]" strokeWidth={1.5} />
            <h3 className="text-display-sm mt-5">{f.successTitle}</h3>
            <p className="text-lead mt-4 text-bark">{f.successBody}</p>
            <p className="mt-8 text-sm text-bark">{f.reference}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-wider">{status.reference}</p>
            <p className="mt-6 text-sm text-bark">{status.emailSent ? f.emailSent : f.emailFailed}</p>
            <p className="mt-2 text-xs text-bark">{t.noPayment}</p>
            <Button type="button" variant="outline-dark" className="mt-8" icon={false} onClick={close}>
              {f.close}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-6 py-6 sm:px-8 sm:py-8">
            <p className="text-sm text-bark">{f.requiredNote}</p>
            {preview && <p className="mt-3 rounded-sm bg-sand/40 p-3 text-sm">{t.previewDisabled}</p>}

            {mode === "departures" && (
              <fieldset className="mt-6">
                <legend className="mb-3 text-sm font-semibold">
                  {f.departure} <span aria-hidden className="text-clay">*</span>
                </legend>
                <div className="grid gap-2" role="radiogroup" aria-describedby={`${idPrefix}-departureId-error`}>
                  {departures.map((d) => (
                    <label
                      key={d.id}
                      className="flex cursor-pointer items-center justify-between gap-4 border border-ink/15 px-4 py-3 transition-colors has-[:checked]:border-ink has-[:checked]:bg-ink/[0.04] has-[:focus-visible]:outline has-[:focus-visible]:outline-2"
                    >
                      <span className="flex items-center gap-3">
                        <input type="radio" value={d.id} {...register("departureId")} className="size-4 accent-[#1e3530]" />
                        <span>
                          <span className="block font-semibold">{formatDateLong(d.date, locale, d.time)}</span>
                          {d.remaining != null && (
                            <span className="text-xs text-bark">{d.remaining === 1 ? t.remainingOne : format(t.remaining, { count: d.remaining })}</span>
                          )}
                        </span>
                      </span>
                      {d.priceEur != null && <span className="shrink-0 text-sm font-semibold">{formatEur(d.priceEur, locale)}</span>}
                    </label>
                  ))}
                </div>
                <p
                  id={`${idPrefix}-departureId-error`}
                  role={errors.departureId ? "alert" : undefined}
                  className={errors.departureId ? "mt-2 text-sm text-[#9a3b1f]" : "sr-only"}
                >
                  {msg(errors.departureId?.message)}
                </p>
              </fieldset>
            )}

            <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <FormField id={`${idPrefix}-participants`} label={f.participants} required error={msg(errors.participants?.message)}>
                <input
                  {...register("participants")}
                  {...field("participants")}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxPeople}
                  aria-required
                  className={inputClass}
                />
              </FormField>
              <div className="flex flex-col justify-end pb-6 text-sm text-bark" aria-live="polite">
                {selected?.remaining != null && <span>{format(f.participantsHint, { count: selected.remaining })}</span>}
              </div>

              {mode === "departures" && selected?.priceEur != null && (
                <div className="border border-ink/10 bg-white/60 p-4 sm:col-span-2" aria-live="polite">
                  <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    <dt className="text-bark">{f.pricePerPerson}</dt>
                    <dd className="text-right">{formatEur(selected.priceEur, locale)}</dd>
                    <dt className="font-semibold">{f.total}</dt>
                    <dd className="text-right text-lg font-semibold">{total != null ? formatEur(total, locale) : "—"}</dd>
                  </dl>
                  <p className="mt-2 text-xs text-bark">{f.totalNote}</p>
                </div>
              )}

              <FormField id={`${idPrefix}-firstName`} label={f.firstName} required error={msg(errors.firstName?.message)}>
                <input {...register("firstName")} {...field("firstName")} autoComplete="given-name" aria-required className={inputClass} />
              </FormField>
              <FormField id={`${idPrefix}-lastName`} label={f.lastName} required error={msg(errors.lastName?.message)}>
                <input {...register("lastName")} {...field("lastName")} autoComplete="family-name" aria-required className={inputClass} />
              </FormField>
              <FormField id={`${idPrefix}-email`} label={f.email} required error={msg(errors.email?.message)}>
                <input {...register("email")} {...field("email")} type="email" inputMode="email" autoComplete="email" aria-required className={inputClass} />
              </FormField>
              <FormField id={`${idPrefix}-phone`} label={f.phone} required error={msg(errors.phone?.message)}>
                <input {...register("phone")} {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" aria-required className={inputClass} />
              </FormField>
              <FormField id={`${idPrefix}-specialRequests`} label={f.specialRequests} optionalLabel={f.optional} error={msg(errors.specialRequests?.message)} className="sm:col-span-2">
                <input {...register("specialRequests")} {...field("specialRequests")} placeholder={f.specialPlaceholder} className={inputClass} />
              </FormField>
              <FormField id={`${idPrefix}-message`} label={f.message} optionalLabel={f.optional} error={msg(errors.message?.message)} className="sm:col-span-2">
                <textarea {...register("message")} {...field("message")} rows={3} className={`${inputClass} resize-y`} />
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
              <p className="max-w-xs text-xs text-bark">{t.noPayment}</p>
              <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="!bg-ink !text-bone">
                {isSubmitting ? f.sending : f.submit}
              </Button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
