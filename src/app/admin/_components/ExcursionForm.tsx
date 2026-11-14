"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Eye, Trash2, Wand2, X } from "lucide-react";
import { deleteExcursion, saveExcursion } from "../_actions/excursions";
import { errorMessage, fmt, t } from "../_lib/strings";
import { slugify } from "@/lib/cms/mappers";
import type { ExcursionRow, MediaRow } from "@/lib/cms/types";
import type { ExcursionInput } from "@/lib/cms/schemas";
import { useToast } from "./Toast";
import { Field, Toggle } from "./Field";
import { LangTabs, type Lang } from "./LangTabs";
import { GalleryPicker, SingleImagePicker } from "./MediaPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { Btn, Card, StatusBadge, formatDate } from "./ui";

const LOCALIZED = [
  "title",
  "summary",
  "description",
  "destination",
  "category",
  "duration",
  "difficulty",
  "price_note",
  "availability_note",
  "info",
] as const;
type LocalizedKey = `${(typeof LOCALIZED)[number]}_${Lang}`;

type FormState = {
  slug: string;
  featured: boolean;
  participants: string;
  price_eur: string;
  available_dates: string[];
  cover: MediaRow | null;
  gallery: MediaRow[];
} & Record<LocalizedKey, string>;

function fromRow(row: ExcursionRow | null): FormState {
  const s = {} as Record<LocalizedKey, string>;
  for (const k of LOCALIZED) {
    for (const l of ["el", "en"] as const) {
      const key = `${k}_${l}` as LocalizedKey;
      s[key] = (row?.[key as keyof ExcursionRow] as string | null) ?? "";
    }
  }
  return {
    ...s,
    slug: row?.slug ?? "",
    featured: row?.featured ?? false,
    participants: row?.participants ?? "",
    price_eur: row?.price_eur === null || row?.price_eur === undefined ? "" : String(row.price_eur),
    available_dates: row?.available_dates ?? [],
    cover: row?.cover ?? null,
    gallery: (row?.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => i.media)
      .filter((m): m is MediaRow => Boolean(m)),
  };
}

export function ExcursionForm({ row }: { row: ExcursionRow | null }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => fromRow(row));
  const [saved, setSaved] = useState(() => JSON.stringify(fromRow(row)));
  const [status, setStatus] = useState<"draft" | "published">(row?.status ?? "draft");
  const [lang, setLang] = useState<Lang>("el");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(row));

  const dirty = JSON.stringify(form) !== saved;
  const complete = {
    el: Boolean(form.title_el.trim() && form.summary_el.trim()),
    en: Boolean(form.title_en.trim() && form.summary_en.trim()),
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Suggest a URL from the title until the admin edits it themselves.
      if (!slugTouched && (key === "title_el" || key === "title_en")) {
        next.slug = slugify(String(next.title_el || next.title_en));
      }
      return next;
    });
    setErrors((e) => {
      const autoSlug = !slugTouched && (key === "title_el" || key === "title_en");
      if (!e[key as string] && !(autoSlug && e.slug)) return e;
      const rest = { ...e };
      delete rest[key as string];
      if (autoSlug) delete rest.slug;
      return rest;
    });
  };

  const submit = (nextStatus: "draft" | "published", successMsg: string) => {
    const payload: ExcursionInput = {
      id: row?.id,
      slug: form.slug.trim(),
      status: nextStatus,
      featured: form.featured,
      cover_media_id: form.cover?.id ?? null,
      gallery: form.gallery.map((g) => g.id),
      participants: form.participants,
      price_eur: form.price_eur.trim() === "" ? null : form.price_eur,
      available_dates: form.available_dates.filter(Boolean),
      ...Object.fromEntries(LOCALIZED.flatMap((k) => (["el", "en"] as const).map((l) => [`${k}_${l}`, form[`${k}_${l}`]]))),
    };
    startTransition(async () => {
      const res = await saveExcursion(payload);
      if (!res.ok) {
        const fe = res.fieldErrors ?? {};
        setErrors(fe);
        // Jump to the language tab that holds the first error.
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
      if (!row) router.replace(`/admin/excursions/${res.data.id}`);
      else router.refresh();
    });
  };

  const err = (k: string) => errorMessage(errors[k]);
  const L = t.excursions.fields;
  const lf = (k: (typeof LOCALIZED)[number]) => `${k}_${lang}` as LocalizedKey;

  const previewHref = useMemo(() => (row ? `/${complete.el || !complete.en ? "el" : "en"}/preview/excursions/${row.id}` : null), [row, complete.el, complete.en]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {/* Language-specific content */}
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t.excursions.sections.content}</h2>
            <LangTabs value={lang} onChange={setLang} complete={complete} />
          </div>
          <p className="mb-5 rounded-lg bg-sky-50 p-3 text-xs text-sky-950">{t.excursions.languageNote}</p>
          <div role="tabpanel" id={`panel-${lang}`} aria-labelledby={`tab-${lang}`} lang={lang} className="grid gap-5">
            <Field id={lf("title")} label={L.title} error={err(lf("title"))}>
              <input
                id={lf("title")}
                value={form[lf("title")]}
                onChange={(e) => set(lf("title"), e.target.value)}
                className="admin-input text-base"
                aria-invalid={Boolean(errors[lf("title")]) || undefined}
                maxLength={200}
              />
            </Field>
            <Field id={lf("summary")} label={L.summary} hint={L.summaryHint} error={err(lf("summary"))}>
              <textarea
                id={lf("summary")}
                value={form[lf("summary")]}
                onChange={(e) => set(lf("summary"), e.target.value)}
                rows={2}
                maxLength={600}
                className="admin-input"
                aria-invalid={Boolean(errors[lf("summary")]) || undefined}
              />
            </Field>
            <Field id={lf("description")} label={L.description} hint={L.descriptionHint} optional>
              <textarea
                id={lf("description")}
                value={form[lf("description")]}
                onChange={(e) => set(lf("description"), e.target.value)}
                rows={8}
                className="admin-input"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={lf("destination")} label={L.destination} optional>
                <input id={lf("destination")} value={form[lf("destination")]} onChange={(e) => set(lf("destination"), e.target.value)} className="admin-input" />
              </Field>
              <Field id={lf("category")} label={L.category} optional>
                <input id={lf("category")} value={form[lf("category")]} onChange={(e) => set(lf("category"), e.target.value)} className="admin-input" />
              </Field>
              <Field id={lf("duration")} label={L.duration} optional>
                <input id={lf("duration")} value={form[lf("duration")]} onChange={(e) => set(lf("duration"), e.target.value)} placeholder={L.durationPlaceholder} className="admin-input" />
              </Field>
              <Field id={lf("difficulty")} label={L.difficulty} optional>
                <input id={lf("difficulty")} value={form[lf("difficulty")]} onChange={(e) => set(lf("difficulty"), e.target.value)} placeholder={L.difficultyPlaceholder} className="admin-input" />
              </Field>
              <Field id={lf("price_note")} label={L.priceNote} optional>
                <input id={lf("price_note")} value={form[lf("price_note")]} onChange={(e) => set(lf("price_note"), e.target.value)} placeholder={L.priceNotePlaceholder} className="admin-input" />
              </Field>
              <Field id={lf("availability_note")} label={L.availabilityNote} optional>
                <input id={lf("availability_note")} value={form[lf("availability_note")]} onChange={(e) => set(lf("availability_note"), e.target.value)} className="admin-input" />
              </Field>
            </div>
            <Field id={lf("info")} label={L.info} hint={L.infoHint} optional>
              <textarea id={lf("info")} value={form[lf("info")]} onChange={(e) => set(lf("info"), e.target.value)} rows={4} className="admin-input" />
            </Field>
          </div>
        </Card>

        {/* Shared details */}
        <Card>
          <h2 className="mb-5 text-lg font-semibold">{t.excursions.sections.details}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="participants" label={L.participants} optional>
              <input id="participants" value={form.participants} onChange={(e) => set("participants", e.target.value)} placeholder={L.participantsPlaceholder} className="admin-input" />
            </Field>
            <Field id="price_eur" label={L.price} optional error={err("price_eur")}>
              <input
                id="price_eur"
                inputMode="decimal"
                value={form.price_eur}
                onChange={(e) => set("price_eur", e.target.value)}
                placeholder="0.00"
                className="admin-input"
                aria-invalid={Boolean(errors.price_eur) || undefined}
              />
            </Field>
          </div>
          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-semibold">
              {L.dates} <span className="text-xs font-normal text-bark/80">({t.common.optional})</span>
            </legend>
            <ul className="mb-2 flex flex-wrap gap-2">
              {form.available_dates.map((d, i) => (
                <li key={i} className="flex items-center gap-1 rounded-lg bg-stone/60 p-1">
                  <label htmlFor={`date-${i}`} className="sr-only">
                    {L.dates} {i + 1}
                  </label>
                  <input
                    id={`date-${i}`}
                    type="date"
                    value={d}
                    onChange={(e) => set("available_dates", form.available_dates.map((x, j) => (j === i ? e.target.value : x)))}
                    className="admin-input w-auto py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => set("available_dates", form.available_dates.filter((_, j) => j !== i))}
                    aria-label={L.removeDate}
                    className="rounded p-2 text-bark hover:bg-ink/5 hover:text-red-700"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            {errors.available_dates && <p className="mb-2 text-xs text-red-700">{err("available_dates")}</p>}
            <Btn variant="secondary" onClick={() => set("available_dates", [...form.available_dates, ""])}>
              <CalendarPlus aria-hidden className="size-4" />
              {L.addDate}
            </Btn>
          </fieldset>
        </Card>

        <Card>
          <h2 className="mb-5 text-lg font-semibold">{t.excursions.sections.images}</h2>
          <div className="space-y-8">
            <SingleImagePicker id="cover" label={L.cover} value={form.cover} onChange={(m) => set("cover", m)} />
            <GalleryPicker id="gallery" label={L.gallery} value={form.gallery} onChange={(m) => set("gallery", m)} />
          </div>
        </Card>
      </div>

      {/* Publishing sidebar */}
      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.excursions.sections.publishing}</h2>
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-bark">{L.status}</span>
            <StatusBadge status={status} />
          </div>
          {dirty && <p className="mb-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">{t.common.unsavedChanges}</p>}

          <div className="flex flex-col gap-2">
            {status === "published" ? (
              <>
                <Btn variant="publish" disabled={pending} onClick={() => submit("published", t.common.saved)}>
                  {pending ? t.common.saving : t.common.update}
                </Btn>
                <Btn variant="secondary" disabled={pending} onClick={() => submit("draft", t.excursions.unpublished)}>
                  {t.common.unpublish}
                </Btn>
              </>
            ) : (
              <>
                <Btn variant="publish" disabled={pending} onClick={() => submit("published", t.excursions.published)}>
                  {pending ? t.common.saving : t.common.publish}
                </Btn>
                <Btn variant="secondary" disabled={pending} onClick={() => submit("draft", row ? t.common.saved : t.excursions.created)}>
                  {t.common.saveDraft}
                </Btn>
              </>
            )}
            {previewHref && (
              <a href={previewHref} target="_blank" rel="noopener" className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-lagoon hover:bg-lagoon/5">
                <Eye aria-hidden className="size-4" />
                {t.common.preview}
              </a>
            )}
          </div>

          <div className="mt-6 space-y-4 border-t border-ink/10 pt-5">
            <Field id="slug" label={L.slug} hint={L.slugHint} error={err("slug")}>
              <div className="flex gap-2">
                <input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase());
                  }}
                  className="admin-input font-mono text-sm"
                  aria-invalid={Boolean(errors.slug) || undefined}
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => set("slug", slugify(form.title_el || form.title_en))}
                  title={L.generateSlug}
                  aria-label={L.generateSlug}
                  className="rounded-lg px-2.5 ring-1 ring-ink/15 hover:bg-stone/60"
                >
                  <Wand2 aria-hidden className="size-4" />
                </button>
              </div>
            </Field>
            <p className="break-all text-xs text-bark">/el/activities/{form.slug || "…"}</p>
            <Toggle id="featured" label={L.featured} hint={L.featuredHint} checked={form.featured} onChange={(v) => set("featured", v)} />
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
            const res = await deleteExcursion(row.id);
            setDeleting(false);
            if (!res.ok) {
              toast("error", t.common.error);
              return;
            }
            setSaved(JSON.stringify(form));
            toast("success", t.common.deleted);
            router.replace("/admin/excursions");
          }}
        />
      )}
    </div>
  );
}
