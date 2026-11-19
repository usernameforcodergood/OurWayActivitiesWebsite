"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  EXPERIENCE_TYPES,
  MAX_GROUP,
  athensToday,
  tailorMadeRequestSchema,
  type SubmitError,
  type SubmitResponse,
  type TailorMadeRequestData,
  type TailorMadeRequestInput,
} from "@/lib/bookings/validation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { FormField, inputClass } from "./FormField";

type Props = {
  locale: Locale;
  t: Dictionary["tailorMade"]["form"];
  common: Dictionary["booking"]["form"];
  notBooking: string;
  privacyHref: string;
};
type Status = { kind: "idle" } | { kind: "success"; reference: string; emailSent: boolean } | { kind: "error"; code: SubmitError | "network" };

const EMPTY: Omit<TailorMadeRequestInput, "startedAt" | "locale" | "idempotencyKey" | "experienceType"> & { experienceType: string } = {
  fullName: "",
  email: "",
  phone: "",
  destination: "",
  dateFrom: "",
  dateTo: "",
  datesFlexible: false,
  participants: "",
  experienceType: "",
  budgetPerPerson: "",
  description: "",
  additionalRequirements: "",
  consent: false,
  website: "",
};

const noSubscribe = () => () => {};

/** Tailor-made experience request. Saved as a new request; never a booking or a quote. */
export function TailorMadeForm({ locale, t, common, notBooking, privacyHref }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Client-only (the page is prerendered): today's date for the date pickers' minimum.
  const today = useSyncExternalStore(noSubscribe, athensToday, () => undefined);
  const statusRef = useRef<HTMLDivElement>(null);
  const defaults = () => ({ ...EMPTY, startedAt: Date.now(), locale, idempotencyKey: crypto.randomUUID() }) as unknown as TailorMadeRequestInput;
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TailorMadeRequestInput, unknown, TailorMadeRequestData>({
    resolver: zodResolver(tailorMadeRequestSchema),
    mode: "onTouched",
    defaultValues: { ...EMPTY, startedAt: 0, locale, idempotencyKey: "00000000-0000-4000-8000-000000000000" } as unknown as TailorMadeRequestInput,
  });
  const dateFrom = useWatch({ control, name: "dateFrom" });

  // Client-only values (time, random key) are set after hydration.
  useEffect(() => {
    setValue("startedAt", Date.now());
    setValue("idempotencyKey", crypto.randomUUID());
  }, [setValue]);

  useEffect(() => {
    if (status.kind !== "idle") statusRef.current?.focus();
  }, [status]);

  const errorText = (code: string) => (t.errors as Record<string, string>)[code] ?? (common.errors as Record<string, string>)[code] ?? t.errors.generic;
  const msg = (code?: string) => (code ? errorText(code) : undefined);
  const field = (name: keyof TailorMadeRequestInput) => ({
    id: `tm-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": `tm-${name}-error`,
  });

  const onSubmit = async (data: TailorMadeRequestData) => {
    setStatus({ kind: "idle" });
    let res: Response;
    try {
      res = await fetch("/api/tailor-made-requests", {
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
      for (const [f, code] of Object.entries(body.fields ?? {})) setError(f as keyof TailorMadeRequestInput, { message: code });
      setStatus({ kind: "error", code: body.error });
    } else setStatus({ kind: "error", code: "generic" });
  };

  if (status.kind === "success") {
    return (
      <motion.div ref={statusRef} tabIndex={-1} role="status" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="py-10 outline-none">
        <CheckCircle2 aria-hidden className="size-10 text-[#2f6f5c]" strokeWidth={1.5} />
        <h3 className="text-display-md mt-6 max-w-[20ch] text-ink">{t.successTitle}</h3>
        <p className="text-lead mt-4 max-w-xl text-bark">{t.successBody}</p>
        <p className="mt-8 text-sm text-bark">{common.reference}</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-ink">{status.reference}</p>
        {status.emailSent && <p className="mt-6 text-sm text-bark">{t.emailSent}</p>}
        <Button
          type="button"
          variant="outline-dark"
          className="mt-10"
          icon={false}
          onClick={() => {
            reset(defaults());
            setStatus({ kind: "idle" });
          }}
        >
          {t.another}
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="tm-form-title" className="text-ink">
      <h2 id="tm-form-title" className="text-display-sm">
        {t.title}
      </h2>
      <p className="mt-4 max-w-2xl text-bark">{t.lead}</p>
      <p className="mt-4 text-sm text-bark">{common.requiredNote}</p>

      <fieldset className="mt-10">
        <legend className="text-eyebrow mb-6 text-bark">{t.contactLegend}</legend>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <FormField id="tm-fullName" label={t.fullName} required error={msg(errors.fullName?.message)} className="sm:col-span-2">
            <input {...register("fullName")} {...field("fullName")} autoComplete="name" placeholder={t.fullNamePlaceholder} aria-required className={inputClass} />
          </FormField>
          <FormField id="tm-email" label={t.email} required error={msg(errors.email?.message)}>
            <input {...register("email")} {...field("email")} type="email" inputMode="email" autoComplete="email" aria-required className={inputClass} />
          </FormField>
          <FormField id="tm-phone" label={t.phone} required error={msg(errors.phone?.message)}>
            <input {...register("phone")} {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" aria-required className={inputClass} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="mt-12">
        <legend className="text-eyebrow mb-6 text-bark">{t.experienceLegend}</legend>

        <fieldset aria-describedby="tm-experienceType-error" aria-invalid={errors.experienceType ? true : undefined}>
          <legend className="mb-3 text-sm font-semibold">
            {t.experienceType}
            <span aria-hidden className="text-clay">
              {" "}*
            </span>
          </legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {EXPERIENCE_TYPES.map((type) => (
              <label key={type} className="relative cursor-pointer">
                <input {...register("experienceType")} type="radio" value={type} className="peer sr-only" />
                <span
                  className={cn(
                    "flex h-full min-h-12 items-center justify-center rounded-2xl border px-3 py-2.5 text-center text-sm font-medium leading-snug transition-colors duration-300 sm:rounded-full sm:px-4",
                    "border-ink/20 text-ink hover:border-ink/60",
                    "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bone",
                    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                    errors.experienceType && "border-[#9a3b1f]/60",
                  )}
                >
                  {t.types[type]}
                </span>
              </label>
            ))}
          </div>
          <p
            id="tm-experienceType-error"
            role={errors.experienceType ? "alert" : undefined}
            className={errors.experienceType ? "mt-2 text-sm text-[#9a3b1f]" : "sr-only"}
          >
            {msg(errors.experienceType?.message)}
          </p>
        </fieldset>

        <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <FormField id="tm-destination" label={t.destination} optionalLabel={common.optional} error={msg(errors.destination?.message)} className="sm:col-span-2">
            <input {...register("destination")} {...field("destination")} placeholder={t.destinationPlaceholder} className={inputClass} />
          </FormField>

          <fieldset className="sm:col-span-2" aria-describedby="tm-dates-hint">
            <legend className="sr-only">{t.dateFrom}</legend>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <FormField id="tm-dateFrom" label={t.dateFrom} required error={msg(errors.dateFrom?.message)}>
                <input
                  {...register("dateFrom")}
                  {...field("dateFrom")}
                  type="date"
                  min={today}
                  aria-required
                  className={`${inputClass} [color-scheme:light]`}
                />
              </FormField>
              <FormField id="tm-dateTo" label={t.dateTo} optionalLabel={common.optional} error={msg(errors.dateTo?.message)}>
                <input {...register("dateTo")} {...field("dateTo")} type="date" min={dateFrom || today} className={`${inputClass} [color-scheme:light]`} />
              </FormField>
            </div>
            <p id="tm-dates-hint" className="-mt-3 text-xs text-bark">
              {t.datesHint}
            </p>
            <label className="mt-3 flex items-center gap-3 text-sm text-bark">
              <input type="checkbox" {...register("datesFlexible")} className="size-5 accent-[#1e3530]" />
              {t.datesFlexible}
            </label>
          </fieldset>

          <FormField id="tm-participants" label={t.participants} required error={msg(errors.participants?.message)}>
            <input
              {...register("participants")}
              {...field("participants")}
              type="number"
              min={1}
              max={MAX_GROUP}
              inputMode="numeric"
              aria-required
              className={inputClass}
            />
          </FormField>
          <FormField id="tm-budgetPerPerson" label={t.budget} optionalLabel={common.optional} error={msg(errors.budgetPerPerson?.message)}>
            <input {...register("budgetPerPerson")} {...field("budgetPerPerson")} placeholder={t.budgetPlaceholder} className={inputClass} />
          </FormField>

          <FormField id="tm-description" label={t.description} required error={msg(errors.description?.message)} className="sm:col-span-2">
            <textarea
              {...register("description")}
              {...field("description")}
              rows={5}
              maxLength={3000}
              placeholder={t.descriptionPlaceholder}
              aria-required
              className={`${inputClass} resize-y`}
            />
          </FormField>
          <FormField
            id="tm-additionalRequirements"
            label={t.additional}
            optionalLabel={common.optional}
            error={msg(errors.additionalRequirements?.message)}
            className="sm:col-span-2"
          >
            <textarea
              {...register("additionalRequirements")}
              {...field("additionalRequirements")}
              rows={3}
              maxLength={2000}
              placeholder={t.additionalPlaceholder}
              className={`${inputClass} resize-y`}
            />
          </FormField>
        </div>
      </fieldset>

      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="tm-website">{common.honeypot}</label>
        <input {...register("website")} id="tm-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-bark">{t.privacy}</p>
      <div className="mt-4 flex items-start gap-3">
        <input {...register("consent")} {...field("consent")} type="checkbox" aria-required className="mt-1 size-5 shrink-0 accent-[#1e3530]" />
        <label htmlFor="tm-consent" className="text-sm leading-relaxed text-bark">
          {common.consent}{" "}
          <Link href={privacyHref} className="font-semibold text-ink underline underline-offset-4">
            {common.consentLink}
          </Link>
          . <span aria-hidden className="text-clay">*</span>
        </label>
      </div>
      <p id="tm-consent-error" role={errors.consent ? "alert" : undefined} className={errors.consent ? "mt-2 text-sm text-[#9a3b1f]" : "sr-only"}>
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
                <p className="mt-1 text-bark">{errorText(status.code)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs text-bark">{notBooking}</p>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="!bg-ink !text-bone">
          {isSubmitting ? t.sending : t.submit}
        </Button>
      </div>
    </form>
  );
}
