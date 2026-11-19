"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Plus } from "lucide-react";
import type { CalendarTemplate } from "../_lib/calendar";
import { t } from "../_lib/strings";
import { Field } from "./Field";
import { Btn, BtnLink } from "./ui";

const C = t.calendar;

/** Pick an existing excursion + a start date → its page opens with the "new date" dialog prefilled. */
export function CalendarQuickAdd({ templates, defaultDate }: { templates: CalendarTemplate[]; defaultDate: string }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [date, setDate] = useState(defaultDate);

  return (
    <form
      id="calendar-add"
      className="scroll-mt-24"
      onSubmit={(e) => {
        e.preventDefault();
        if (id) router.push(`/admin/excursions/${id}?newDate=${encodeURIComponent(date)}`);
      }}
    >
      <h3 className="text-sm font-semibold">{C.quickTitle}</h3>
      <p className="mt-1 text-xs text-bark">{C.quickHint}</p>
      <div className="mt-3 space-y-3">
        <Field id="cal-template" label={C.quickExcursion}>
          <select id="cal-template" required value={id} onChange={(e) => setId(e.target.value)} className="admin-input">
            <option value="">{C.quickChoose}</option>
            {templates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
                {x.status === "draft" ? ` (${C.draft})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field id="cal-date" label={C.quickDate}>
          <input id="cal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="admin-input" />
        </Field>
        <Btn type="submit" disabled={!id} className="w-full">
          <CalendarPlus aria-hidden className="size-4" />
          {C.quickGo}
        </Btn>
        <BtnLink href="/admin/excursions/new" variant="secondary" className="w-full">
          <Plus aria-hidden className="size-4" />
          {C.quickNew}
        </BtnLink>
      </div>
    </form>
  );
}
