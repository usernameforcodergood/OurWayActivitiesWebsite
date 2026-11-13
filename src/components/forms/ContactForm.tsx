"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  contactSchema,
  type ContactData,
  type ContactInput,
  type ContactResponse,
  type FieldErrorCode,
} from "@/lib/validation";
import { Button } from "@/components/ui/Button";
import { FormField, inputClass } from "./FormField";

type Props = { locale: Locale; t: Dictionary["contact"]["form"]; privacyHref: string };
type Status = { kind: "idle" } | { kind: "success" } | { kind: "error"; code: keyof Dictionary["contact"]["form"]["errors"] };

/**
 * Inquiry form. Validates on the client with the same Zod schema the server
 * uses, and only shows success after the server confirms delivery.
 */
export function ContactForm({ locale, t, privacyHref }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const statusRef = useRef<HTMLDivElement>(null);
  const dateInput = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput, unknown, ContactData>({
    resolver: zodResolver(contactSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      interest: "",
      date: "",
      participants: "",
      message: "",
      consent: false,
      website: "",
      startedAt: 0,
      locale,
    },
  });

  // Client-only values: render timestamp (anti-spam), today's date, ?interest= prefill.
  useEffect(() => {
    setValue("startedAt", Date.now());
    dateInput.current?.setAttribute("min", new Date().toISOString().slice(0, 10));
    const interest = new URLSearchParams(window.location.search).get("interest");
    if (interest) setValue("interest", interest.slice(0, 200));
  }, [setValue]);

  const msg = (code?: string) => (code ? (t.errors[code as FieldErrorCode] ?? t.errors.generic) : undefined);

  const onSubmit = async (data: ContactData) => {
    setStatus({ kind: "idle" });
    let res: Response;
    try {
      res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      setStatus({ kind: "error", code: "network" });
      return;
    }
    let body: ContactResponse | null = null;
    try {
      body = (await res.json()) as ContactResponse;
    } catch {
      body = null;
    }
    if (res.ok && body?.ok) {
      setStatus({ kind: "success" });
      reset({ ...data, name: "", email: "", phone: "", interest: "", date: "", participants: "", message: "", consent: false });
    } else if (body && !body.ok) {
      if (body.fields) {
        for (const [field, code] of Object.entries(body.fields)) {
          setError(field as keyof ContactInput, { message: code });
        }
      }
      setStatus({ kind: "error", code: body.error });
    } else {
      setStatus({ kind: "error", code: "generic" });
    }
  };

  useEffect(() => {
    if (status.kind !== "idle") statusRef.current?.focus();
  }, [status]);

  const field = (name: keyof ContactInput) => ({
    id: `contact-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": `contact-${name}-error`,
  });

  if (status.kind === "success") {
    return (
      <motion.div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[28rem] flex-col items-start justify-center outline-none"
      >
        <CheckCircle2 aria-hidden className="size-10 text-[#2f6f5c]" strokeWidth={1.5} />
        <h3 className="text-display-md mt-6 text-ink">{t.successTitle}</h3>
        <p className="text-lead mt-4 text-bark">{t.successBody}</p>
        <Button type="button" variant="outline-dark" className="mt-10" onClick={() => setStatus({ kind: "idle" })} icon={false}>
          {t.sendAnother}
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="contact-form-title" className="text-ink">
      <h2 id="contact-form-title" className="text-display-sm">
        {t.title}
      </h2>
      <p className="mt-2 text-sm text-bark">{t.requiredNote}</p>

      <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <FormField id="contact-name" label={t.name} required error={msg(errors.name?.message)}>
          <input {...register("name")} {...field("name")} type="text" autoComplete="name" aria-required className={inputClass} />
        </FormField>
        <FormField id="contact-email" label={t.email} required error={msg(errors.email?.message)}>
          <input {...register("email")} {...field("email")} type="email" autoComplete="email" inputMode="email" aria-required className={inputClass} />
        </FormField>
        <FormField id="contact-phone" label={t.phone} optionalLabel={t.optional} error={msg(errors.phone?.message)}>
          <input {...register("phone")} {...field("phone")} type="tel" autoComplete="tel" inputMode="tel" className={inputClass} />
        </FormField>
        <FormField id="contact-interest" label={t.interest} optionalLabel={t.optional} error={msg(errors.interest?.message)}>
          <input {...register("interest")} {...field("interest")} type="text" placeholder={t.interestPlaceholder} className={inputClass} />
        </FormField>
        <FormField id="contact-date" label={t.date} optionalLabel={t.optional} error={msg(errors.date?.message)}>
          {(() => {
            const { ref, ...rest } = register("date");
            return (
              <input
                {...rest}
                ref={(el) => {
                  ref(el);
                  dateInput.current = el;
                }}
                {...field("date")}
                type="date"
                className={`${inputClass} [color-scheme:light]`}
              />
            );
          })()}
        </FormField>
        <FormField id="contact-participants" label={t.participants} optionalLabel={t.optional} error={msg(errors.participants?.message)}>
          <input {...register("participants")} {...field("participants")} type="number" min={1} max={100} inputMode="numeric" className={inputClass} />
        </FormField>
        <FormField id="contact-message" label={t.message} required error={msg(errors.message?.message)} className="sm:col-span-2">
          <textarea
            {...register("message")}
            {...field("message")}
            rows={5}
            placeholder={t.messagePlaceholder}
            aria-required
            className={`${inputClass} resize-y`}
          />
        </FormField>
      </div>

      {/* Honeypot — hidden from people and assistive tech, bots fill it in */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">{t.honeypot}</label>
        <input {...register("website")} id="contact-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-8">
        <div className="flex items-start gap-3">
          <input
            {...register("consent")}
            {...field("consent")}
            type="checkbox"
            aria-required
            className="mt-1 size-5 shrink-0 accent-[#1e3530]"
          />
          <label htmlFor="contact-consent" className="text-sm leading-relaxed text-bark">
            {t.consent}{" "}
            <Link href={privacyHref} className="font-semibold text-ink underline underline-offset-4">
              {t.consentLink}
            </Link>
            . <span aria-hidden className="text-clay">*</span>
          </label>
        </div>
        <p id="contact-consent-error" role={errors.consent ? "alert" : undefined} className={errors.consent ? "mt-2 text-sm text-[#9a3b1f]" : "sr-only"}>
          {msg(errors.consent?.message)}
        </p>
      </div>

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
            <div className="flex gap-3 border-l-2 border-[#9a3b1f] bg-[#9a3b1f]/[0.06] p-4 text-sm text-ink">
              <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-[#9a3b1f]" />
              <div>
                <p className="font-semibold">{t.errorTitle}</p>
                <p className="mt-1 text-bark">{t.errors[status.code]}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xs text-xs text-bark">{t.privacyNote}</p>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="!bg-ink !text-bone">
          {isSubmitting ? t.sending : t.submit}
        </Button>
      </div>
    </form>
  );
}
