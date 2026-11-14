"use client";

import { useState, useTransition } from "react";
import { saveSettings } from "../_actions/settings";
import { errorMessage, t } from "../_lib/strings";
import type { SiteSettingsRow } from "@/lib/cms/types";
import { useToast } from "./Toast";
import { Field } from "./Field";
import { Btn } from "./ui";

const FIELDS = [
  ["email", t.settings.email, "email"],
  ["phone", t.settings.phone, "tel"],
  ["address_el", t.settings.addressEl, "text"],
  ["address_en", t.settings.addressEn, "text"],
  ["instagram_url", t.settings.instagram, "url"],
  ["facebook_url", t.settings.facebook, "url"],
  ["linkedin_url", t.settings.linkedin, "url"],
] as const;

type Key = (typeof FIELDS)[number][0];

export function SettingsForm({ initial }: { initial: SiteSettingsRow | null }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<Key, string>>(
    () => Object.fromEntries(FIELDS.map(([k]) => [k, initial?.[k] ?? ""])) as Record<Key, string>,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettings(values);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            toast("error", errorMessage(Object.values(res.fieldErrors ?? {})[0] ?? res.error) ?? t.common.error);
            return;
          }
          setErrors({});
          toast("success", t.common.saved);
        });
      }}
      className="grid gap-5 sm:grid-cols-2"
    >
      {FIELDS.map(([key, label, type]) => (
        <Field key={key} id={key} label={label} optional error={errorMessage(errors[key])}>
          <input
            id={key}
            type={type}
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            className="admin-input"
            aria-invalid={Boolean(errors[key]) || undefined}
            lang={key.endsWith("_en") ? "en" : undefined}
          />
        </Field>
      ))}
      <div className="sm:col-span-2">
        <Btn type="submit" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Btn>
      </div>
    </form>
  );
}
