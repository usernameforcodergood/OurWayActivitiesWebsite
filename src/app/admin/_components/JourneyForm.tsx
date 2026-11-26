"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { deleteJourney, saveJourney } from "../_actions/journeys";
import { errorMessage, fmt, t } from "../_lib/strings";
import type { AdminJourneyRow, JourneyDepartureOption, JourneyExcursionOption } from "../_lib/journey-queries";
import { slugify } from "@/lib/cms/mappers";
import type { MediaRow } from "@/lib/cms/types";
import { useToast } from "./Toast";
import { Field, Toggle } from "./Field";
import { LangTabs, type Lang } from "./LangTabs";
import { GalleryPicker } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { Btn, Card, StatusBadge, formatDate, formatRun } from "./ui";

const LOCALIZED = ["title", "summary", "description", "quote", "location"] as const;
type LocalKey = `${(typeof LOCALIZED)[number]}_${Lang}`;

type FormState = Record<LocalKey, string> & {
  excursion_id: string;
  departure_id: string;
  slug: string;
  occurred_on: string;
  occurred_until: string;
  photo_consent_confirmed: boolean;
  cover_media_id: string | null;
  gallery: MediaRow[];
};

function fromRow(row: AdminJourneyRow | null): FormState {
  const local = Object.fromEntries(
    LOCALIZED.flatMap((k) => (["el", "en"] as const).map((l) => [`${k}_${l}`, (row?.[`${k}_${l}`] as string | null) ?? ""])),
  ) as Record<LocalKey, string>;
  return {
    ...local,
    excursion_id: row?.excursion_id ?? "",
    departure_id: row?.departure_id ?? "",
    slug: row?.slug ?? "",
    occurred_on: row?.occurred_on ?? "",
    occurred_until: row?.occurred_until ?? "",
    photo_consent_confirmed: row?.photo_consent_confirmed ?? false,
    cover_media_id: row?.cover_media_id ?? null,
    gallery: (row?.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => i.media)
      .filter((m): m is MediaRow => m !== null),
  };
}

const excursionName = (e: JourneyExcursionOption) => e.title_el || e.title_en || t.common.untitled;

export function JourneyForm({
  row,
  excursions,
  departures,
}: {
  row: AdminJourneyRow | null;
  excursions: JourneyExcursionOption[];
  departures: JourneyDepartureOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => fromRow(row));
  const [saved, setSaved] = useState(() => JSON.stringify(fromRow(row)));
  const [status, setStatus] = useState<"draft" | "published">(row?.status ?? "draft");
  const [lang, setLang] = useState<Lang>("el");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(row));

  const dirty = JSON.stringify(form) !== saved;
  const complete = {
    el: Boolean(form.title_el.trim() && form.summary_el.trim()),
    en: Boolean(form.title_en.trim() && form.summary_en.trim()),
  };
  const runs = useMemo(() => departures.filter((d) => d.excursion_id === form.excursion_id), [departures, form.excursion_id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const autoSlug = (f: FormState) => {
    const base = slugify(f.title_el || f.title_en);
    return base && f.occurred_on ? `${base}-${f.occurred_on.slice(0, 7)}` : base;
  };

  const patch = (changes: Partial<FormState>) => {
    setForm((f) => {
      const next = { ...f, ...changes };
      if (!slugTouched) next.slug = autoSlug(next);
      return next;
    });
    setErrors((e) => {
      const rest = { ...e };
      for (const k of Object.keys(changes)) delete rest[k];
      return rest;
    });
  };

  /** Picking the excursion pre-fills empty texts from it (all editable). */
  const chooseExcursion = (id: string) => {
    const ex = excursions.find((e) => e.id === id);
    const fill = (k: LocalKey, v: string | null) => (form[k].trim() || !v ? {} : { [k]: v });
    patch({
      excursion_id: id,
      departure_id: "",
      ...(ex
        ? {
            ...fill("title_el", ex.title_el),
            ...fill("title_en", ex.title_en),
            ...fill("location_el", ex.destination_el),
            ...fill("location_en", ex.destination_en),
          }
        : {}),
    });
  };

  /** Picking the run sets the dates it took place. */
  const chooseDeparture = (id: string) => {
    const d = departures.find((x) => x.id === id);
    patch({
      departure_id: id,
      ...(d ? { occurred_on: d.departure_date, occurred_until: d.return_date && d.return_date !== d.departure_date ? d.return_date : "" } : {}),
    });
  };

  const submit = (nextStatus: "draft" | "published", successMsg: string) => {
    start(async () => {
      const res = await saveJourney({
        id: row?.id,
        excursion_id: form.excursion_id,
        departure_id: form.departure_id || null,
        slug: form.slug.trim(),
        status: nextStatus,
        cover_media_id: form.cover_media_id,
        title_el: form.title_el,
        title_en: form.title_en,
        summary_el: form.summary_el,
        summary_en: form.summary_en,
        description_el: form.description_el,
        description_en: form.description_en,
        quote_el: form.quote_el,
        quote_en: form.quote_en,
        location_el: form.location_el,
        location_en: form.location_en,
        occurred_on: form.occurred_on,
        occurred_until: form.occurred_until || null,
        photo_consent_confirmed: form.photo_consent_confirmed,
        gallery: form.gallery.map((g) => g.id),
      });
      if (!res.ok) {
        const fe = res.fieldErrors ?? {};
        setErrors(fe);
        const first = Object.keys(fe)[0];
        if (first?.endsWith("_en")) setLang("en");
        else if (first?.endsWith("_el")) setLang("el");
        toast("error", errorMessage(Object.values(fe)[0] ?? res.error) ?? t.common.error);
        return;
      }
      setErrors({});
      setStatus(nextStatus);
      setSaved(JSON.stringify(form));
      toast("success", successMsg);
      if (!row) router.replace(`/admin/journeys/${res.data.id}`);
      else router.refresh();
    });
  };

  const err = (k: string) => errorMessage(errors[k]);
  const L = t.journeys.fields;
  const lf = (p: (typeof LOCALIZED)[number]) => `${p}_${lang}` as LocalKey;
  const publicLang = complete.el || !complete.en ? "el" : "en";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card>
          <h2 className="mb-5 text-lg font-semibold">{t.journeys.sections.link}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="excursion_id" label={L.excursion} error={err("excursion_id")} className="sm:col-span-2">
              <select
                id="excursion_id"
                value={form.excursion_id}
                onChange={(e) => chooseExcursion(e.target.value)}
                className="admin-input"
                aria-invalid={Boolean(errors.excursion_id) || undefined}
              >
                <option value="">{L.chooseExcursion}</option>
                {excursions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {excursionName(e)}
                    {e.status === "draft" ? ` (${t.common.draft})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {form.excursion_id && (
              <Field id="departure_id" label={L.departure} hint={runs.length ? L.departureHint : L.noPastDepartures} error={err("departure_id")} className="sm:col-span-2">
                <select
                  id="departure_id"
                  value={form.departure_id}
                  onChange={(e) => chooseDeparture(e.target.value)}
                  className="admin-input"
                  aria-invalid={Boolean(errors.departure_id) || undefined}
                >
                  <option value="">{L.noDeparture}</option>
                  {runs.map((d) => {
                    const taken = d.takenBy !== null && d.takenBy !== row?.id;
                    return (
                      <option key={d.id} value={d.id} disabled={taken}>
                        {formatRun(d.departure_date, d.return_date, d.departure_time)}
                        {d.status === "completed" ? ` · ${t.journeys.completedRun}` : ""}
                        {taken ? ` · ${L.alreadyArchived}` : ""}
                      </option>
                    );
                  })}
                </select>
              </Field>
            )}
            <Field id="occurred_on" label={L.occurredOn} error={err("occurred_on")}>
              <input
                id="occurred_on"
                type="date"
                value={form.occurred_on}
                onChange={(e) => patch({ occurred_on: e.target.value })}
                className="admin-input"
                aria-invalid={Boolean(errors.occurred_on) || undefined}
              />
            </Field>
            <Field id="occurred_until" label={L.occurredUntil} hint={L.occurredUntilHint} optional error={err("occurred_until")}>
              <input
                id="occurred_until"
                type="date"
                value={form.occurred_until}
                min={form.occurred_on || undefined}
                onChange={(e) => patch({ occurred_until: e.target.value })}
                className="admin-input"
                aria-invalid={Boolean(errors.occurred_until) || undefined}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t.journeys.sections.content}</h2>
            <LangTabs value={lang} onChange={setLang} complete={complete} />
          </div>
          <p className="mb-5 rounded-lg bg-sky-50 p-3 text-xs text-sky-950">{t.excursions.languageNote}</p>
          <div role="tabpanel" id={`panel-${lang}`} aria-labelledby={`tab-${lang}`} lang={lang} className="grid gap-5">
            <Field id={lf("title")} label={L.title} error={err(lf("title"))}>
              <input id={lf("title")} value={form[lf("title")]} onChange={(e) => patch({ [lf("title")]: e.target.value })} className="admin-input text-base" maxLength={200} aria-invalid={Boolean(errors[lf("title")]) || undefined} />
            </Field>
            <Field id={lf("summary")} label={L.summary} hint={L.summaryHint} error={err(lf("summary"))}>
              <textarea id={lf("summary")} value={form[lf("summary")]} onChange={(e) => patch({ [lf("summary")]: e.target.value })} rows={2} maxLength={600} className="admin-input" aria-invalid={Boolean(errors[lf("summary")]) || undefined} />
            </Field>
            <Field id={lf("location")} label={L.location} hint={L.locationHint} optional>
              <input id={lf("location")} value={form[lf("location")]} onChange={(e) => patch({ [lf("location")]: e.target.value })} className="admin-input" maxLength={200} />
            </Field>
            <Field id={lf("description")} label={L.description} optional>
              <RichTextEditor
                key={lang}
                id={lf("description")}
                value={form[lf("description")]}
                onChange={(html) => patch({ [lf("description")]: html })}
                label={`${L.description} (${lang.toUpperCase()})`}
              />
            </Field>
            <Field id={lf("quote")} label={L.quote} hint={L.quoteHint} optional>
              <textarea id={lf("quote")} value={form[lf("quote")]} onChange={(e) => patch({ [lf("quote")]: e.target.value })} rows={2} maxLength={600} className="admin-input" />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-lg font-semibold">{t.journeys.sections.photos}</h2>
          <p className="mb-5 text-sm text-bark">{L.photosHint}</p>
          <GalleryPicker
            id="gallery"
            label={L.photos}
            value={form.gallery}
            onChange={(m) => patch({ gallery: m })}
            cover={{ id: form.cover_media_id, onChange: (id) => patch({ cover_media_id: id }), label: L.cover, setLabel: L.setCover }}
          />
          {!form.cover_media_id && form.gallery.length > 0 && <p className="mt-3 text-xs text-bark">{L.noCover}</p>}
        </Card>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.journeys.sections.publishing}</h2>
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-bark">{t.excursions.fields.status}</span>
            <StatusBadge status={status} />
          </div>
          {dirty && <p className="mb-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">{t.common.unsavedChanges}</p>}

          <div className="mb-5 rounded-lg bg-stone/50 p-3">
            <Toggle
              id="photo_consent_confirmed"
              label={L.consent}
              hint={L.consentHint}
              checked={form.photo_consent_confirmed}
              onChange={(v) => patch({ photo_consent_confirmed: v })}
            />
            {errors.photo_consent_confirmed && (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <ShieldCheck aria-hidden className="size-4" />
                {err("photo_consent_confirmed")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {status === "published" ? (
              <>
                <Btn variant="publish" disabled={pending} onClick={() => submit("published", t.common.saved)}>
                  {pending ? t.common.saving : t.common.update}
                </Btn>
                <Btn variant="secondary" disabled={pending} onClick={() => submit("draft", t.journeys.unpublished)}>
                  {t.common.unpublish}
                </Btn>
              </>
            ) : (
              <>
                <Btn variant="publish" disabled={pending} onClick={() => submit("published", t.journeys.published)}>
                  {pending ? t.common.saving : t.common.publish}
                </Btn>
                <Btn variant="secondary" disabled={pending} onClick={() => submit("draft", row ? t.common.saved : t.journeys.created)}>
                  {t.common.saveDraft}
                </Btn>
              </>
            )}
            {row && status === "published" && (
              <a
                href={`/${publicLang}/journeys/${row.slug}`}
                target="_blank"
                rel="noopener"
                className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-deep-teal hover:bg-turquoise/5"
              >
                <ExternalLink aria-hidden className="size-4" />
                {t.journeys.viewPublic}
              </a>
            )}
          </div>

          <div className="mt-6 space-y-4 border-t border-ink/10 pt-5">
            <Field id="slug" label={t.excursions.fields.slug} hint={t.excursions.fields.slugHint} error={err("slug")}>
              <div className="flex gap-2">
                <input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    patch({ slug: e.target.value.toLowerCase() });
                  }}
                  className="admin-input font-mono text-sm"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.slug) || undefined}
                />
                <button
                  type="button"
                  onClick={() => patch({ slug: autoSlug(form) })}
                  aria-label={t.excursions.fields.generateSlug}
                  title={t.excursions.fields.generateSlug}
                  className="rounded-lg px-2.5 ring-1 ring-ink/15 hover:bg-stone/60"
                >
                  <Wand2 aria-hidden className="size-4" />
                </button>
              </div>
            </Field>
            <p className="break-all text-xs text-bark">/el/journeys/{form.slug || "…"}</p>
          </div>

          {row && (
            <dl className="mt-6 space-y-1 border-t border-ink/10 pt-5 text-xs text-bark">
              <div className="flex justify-between gap-2">
                <dt>{t.common.created}</dt>
                <dd>{formatDate(row.created_at, true)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t.common.updatedAt}</dt>
                <dd>{formatDate(row.updated_at, true)}</dd>
              </div>
            </dl>
          )}
        </Card>
        {row && (
          <Btn variant="ghost" className="w-full text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden className="size-4" />
            {t.common.delete}
          </Btn>
        )}
      </aside>

      {row && (
        <ConfirmDialog
          open={confirmDelete}
          title={t.common.confirmDeleteTitle}
          body={fmt(t.common.confirmDeleteBody, { name: form.title_el || form.title_en || form.slug })}
          busy={deleting}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            const res = await deleteJourney(row.id);
            setDeleting(false);
            if (!res.ok) {
              toast("error", t.common.error);
              return;
            }
            setSaved(JSON.stringify(form));
            toast("success", t.common.deleted);
            router.replace("/admin/journeys");
          }}
        />
      )}
    </div>
  );
}
