"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  privateRequestSchema,
  type PrivateRequestData,
  type PrivateRequestInput,
  type SubmitError,
  type SubmitResponse,
} from "@/lib/bookings/validation";
import { Button } from "@/components/ui/Button";
import { FormField, inputClass } from "./FormField";

type Props = {
  locale: Locale;
  t: Dictionary["privateTrips"]["form"];
  common: Dictionary["booking"]["form"];
  notBooking: string;
  privacyHref: string;
};
type Status = { kind: "idle" } | { kind: "success"; reference: string; emailSent: boolean } | { kind: "error"; code: SubmitError | "network" };

const EMPTY: Omit<PrivateRequestInput, "startedAt" | "locale" | "idempotencyKey"> = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  participants: "",
  destination: "",
  destinationFlexible: false,
  excursionType: "",
  dateFrom: "",
  dateTo: "",
  datesFlexible: false,
  duration: "",
  difficulty: "",
  transport: "",
  activities: "",
  budgetPerPerson: "",
  message: "",
  consent: false,
  website: "",
};

/** "Design your own trip" request. Saved as a new request; never a booking or quote. */
export function PrivateTripForm({ locale, t, common, notBooking, privacyHref }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const statusRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PrivateRequestInput, unknown, PrivateRequestData>({
    resolver: zodResolver(privateRequestSchema),
    mode: "onTouched",
    defaultValues: { ...EMPTY, startedAt: 0, locale, idempotencyKey: "00000000-0000-4000-8000-000000000000" },
  });

  useEffect(() => {
    setValue("startedAt", Date.now());
    setValue("idempotencyKey", crypto.randomUUID());
  }, [setValue]);

  useEffect(() => {
    if (status.kind !== "idle") statusRef.current?.focus();
  }, [status]);

  const msg = (code?: string) => (code ? ((common.errors as Record<string, string>)[code] ?? common.errors.generic) : undefined);
  const field = (name: keyof PrivateRequestInput) => ({
    id: `pg-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": `pg-${name}-error`,
  });

  const onSubmit = async (data: PrivateRequestData) => {
    setStatus({ kind: "idle" });
    let res: Response;
    try {
      res = await fetch("/api/private-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      setStatus({ kind: "error", code: "network" });
      return;
    }
    const body = (await res.json().catch(() => null)) as SubmitResponse | null;
    if (body?.ok) {
      setStatus({ kind: "success", reference: body.reference, emailSent: body.emailSent });
      return;
    }
    if (body && !body.ok) {
      for (const [f, code] of Object.entries(body.fields ?? {})) setError(f as keyof PrivateRequestInput, { message: code });
      setStatus({ kind: "error", code: body.error });
    } else setStatus({ kind: "error", code: "generic" });
  };

  if (status.kind === "success") {
    return (
      <motion.div ref={statusRef} tabIndex={-1} role="status" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="py-10 outline-none">
        <CheckCircle2 aria-hidden className="size-10 text-[#2f6f5c]" strokeWidth={1.5} />
        <h3 className="text-display-md mt-6 text-ink">{t.successTitle}</h3>
        <p className="text-lead mt-4 text-bark">{t.successBody}</p>
        <p className="mt-8 text-sm text-bark">{common.reference}</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-ink">{status.reference}</p>
        <p className="mt-6 text-sm text-bark">{status.emailSent ? common.emailSent : common.emailFailed}</p>
        <Button
          type="button"
          variant="outline-dark"
          className="mt-10"
          icon={false}
          onClick={() => {
            reset({ ...EMPTY, startedAt: Date.now(), locale, idempotencyKey: crypto.randomUUID() });
            setStatus({ kind: "idle" });
          }}
        >
          {t.another}
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="pg-form-title" className="text-ink">
      <h2 id="pg-form-title" className="text-display-sm">
        {t.title}
      </h2>
      <p className="mt-2 text-sm text-bark">{common.requiredNote}</p>

      <fieldset className="mt-10">
        <legend className="text-eyebrow mb-6 text-bark">{t.contactLegend}</legend>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <FormField id="pg-firstName" label={common.firstName} required error={msg(errors.firstName?.message)}>
            <input {...register("firstName")} {...field("firstName")} autoComplete="given-name" aria-required className={inputClass} />
          </FormField>
          <FormField id="pg-lastName" label={common.lastName} required error={msg(errors.lastName?.message)}>
            <input {...register("lastName")} {...field("lastName")} autoComplete="family-name" aria-required className={inputClass} />
          </FormField>
          <FormField id="pg-email" label={common.email} required error={msg(errors.email?.message)}>
            <input {...register("email")} {...field("email")} type="email" inputMode="email" autoComplete="email" aria-required className={inputClass} />
          </FormField>
          <FormField id="pg-phone" label={common.phone} required error={msg(errors.phone?.message)}>
            <input {...register("phone")} {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" aria-required className={inputClass} />
          </FormField>
          <FormField id="pg-participants" label={t.participants} required error={msg(errors.participants?.message)}>
            <input {...register("participants")} {...field("participants")} type="number" min={1} max={500} inputMode="numeric" aria-required className={inputClass} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="mt-12">
        <legend className="text-eyebrow mb-2 text-bark">{t.tripLegend}</legend>
        <p className="mb-6 text-sm text-bark">{t.tripHint}</p>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField id="pg-destination" label={t.destination} optionalLabel={common.optional} error={msg(errors.destination?.message)}>
              <input {...register("destination")} {...field("destination")} placeholder={t.destinationPlaceholder} className={inputClass} />
            </FormField>
            <label className="-mt-3 flex items-center gap-3 text-sm text-bark">
              <input type="checkbox" {...register("destinationFlexible")} className="size-5 accent-[#1e3530]" />
              {t.destinationFlexible}
            </label>
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">
              {t.datesLegend} <span className="text-xs font-normal text-bark">{common.optional}</span>
            </legend>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <FormField id="pg-dateFrom" label={t.dateFrom} error={msg(errors.dateFrom?.message)}>
                <input {...register("dateFrom")} {...field("dateFrom")} type="date" className={`${inputClass} [color-scheme:light]`} />
              </FormField>
              <FormField id="pg-dateTo" label={t.dateTo} error={msg(errors.dateTo?.message)}>
                <input {...register("dateTo")} {...field("dateTo")} type="date" className={`${inputClass} [color-scheme:light]`} />
              </FormField>
            </div>
            <label className="-mt-3 flex items-center gap-3 text-sm text-bark">
              <input type="checkbox" {...register("datesFlexible")} className="size-5 accent-[#1e3530]" />
              {t.datesFlexible}
            </label>
          </fieldset>

          <FormField id="pg-excursionType" label={t.excursionType} optionalLabel={common.optional} error={msg(errors.excursionType?.message)}>
            <input {...register("excursionType")} {...field("excursionType")} placeholder={t.excursionTypePlaceholder} className={inputClass} />
          </FormField>
          <FormField id="pg-duration" label={t.duration} optionalLabel={common.optional} error={msg(errors.duration?.message)}>
            <input {...register("duration")} {...field("duration")} placeholder={t.durationPlaceholder} className={inputClass} />
          </FormField>
          <FormField id="pg-difficulty" label={t.difficulty} optionalLabel={common.optional} error={msg(errors.difficulty?.message)}>
            <select {...register("difficulty")} {...field("difficulty")} className={inputClass}>
              <option value="">{t.difficultyAny}</option>
              <option value={t.difficultyEasy}>{t.difficultyEasy}</option>
              <option value={t.difficultyModerate}>{t.difficultyModerate}</option>
              <option value={t.difficultyDemanding}>{t.difficultyDemanding}</option>
            </select>
          </FormField>
          <FormField id="pg-budgetPerPerson" label={t.budget} optionalLabel={common.optional} error={msg(errors.budgetPerPerson?.message)}>
            <input {...register("budgetPerPerson")} {...field("budgetPerPerson")} placeholder={t.budgetPlaceholder} className={inputClass} />
          </FormField>
          <FormField id="pg-transport" label={t.transport} optionalLabel={common.optional} error={msg(errors.transport?.message)} className="sm:col-span-2">
            <input {...register("transport")} {...field("transport")} placeholder={t.transportPlaceholder} className={inputClass} />
          </FormField>
          <FormField id="pg-activities" label={t.activities} optionalLabel={common.optional} error={msg(errors.activities?.message)} className="sm:col-span-2">
            <textarea {...register("activities")} {...field("activities")} rows={3} className={`${inputClass} resize-y`} />
          </FormField>
          <FormField id="pg-message" label={t.message} optionalLabel={common.optional} error={msg(errors.message?.message)} className="sm:col-span-2">
            <textarea {...register("message")} {...field("message")} rows={3} className={`${inputClass} resize-y`} />
          </FormField>
        </div>
      </fieldset>

      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="pg-website">{common.honeypot}</label>
        <input {...register("website")} id="pg-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-bark">{common.privacy}</p>
      <div className="mt-4 flex items-start gap-3">
        <input {...register("consent")} {...field("consent")} type="checkbox" aria-required className="mt-1 size-5 shrink-0 accent-[#1e3530]" />
        <label htmlFor="pg-consent" className="text-sm leading-relaxed text-bark">
          {common.consent}{" "}
          <Link href={privacyHref} className="font-semibold text-ink underline underline-offset-4">
            {common.consentLink}
          </Link>
          . <span aria-hidden className="text-clay">*</span>
        </label>
      </div>
      <p id="pg-consent-error" role={errors.consent ? "alert" : undefined} className={errors.consent ? "mt-2 text-sm text-[#9a3b1f]" : "sr-only"}>
        {msg(errors.consent?.message)}
      </p>

      <AnimatePresence>
        {status.kind === "error" && (
          <motion.div
            ref={statusRef}
            tabIndex={-1}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-8 overflow-hidden outline-none"
          >
            <div className="flex gap-3 border-l-2 border-[#9a3b1f] bg-[#9a3b1f]/[0.06] p-4 text-sm">
              <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-[#9a3b1f]" />
              <div>
                <p className="font-semibold">{common.errorTitle}</p>
                <p className="mt-1 text-bark">{(common.errors as Record<string, string>)[status.code] ?? common.errors.generic}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs text-bark">{notBooking}</p>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="!bg-ink !text-bone">
          {isSubmitting ? common.sending : t.submit}
        </Button>
      </div>
    </form>
  );
}
