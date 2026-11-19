"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2, Wand2 } from "lucide-react";
import { deleteExcursion, saveExcursion } from "../_actions/excursions";
import { errorMessage, fmt, t } from "../_lib/strings";
import { slugify } from "@/lib/cms/mappers";
import { PRIMARY_CATEGORIES, type ExcursionRow, type MediaRow, type PrimaryCategory } from "@/lib/cms/types";
import type { ExcursionInput } from "@/lib/cms/schemas";
import { useToast } from "./Toast";
import { Field, Toggle } from "./Field";
import { LangTabs, type Lang } from "./LangTabs";
import { GalleryPicker, SingleImagePicker } from "./MediaPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { RichTextEditor } from "./RichTextEditor";
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
  "meeting_point",
  "included",
  "info",
  "cancellation_policy",
] as const;
type LocalizedKey = `${(typeof LOCALIZED)[number]}_${Lang}`;

type FormState = {
  slug: string;
  featured: boolean;
  participants: string;
  price_eur: string;
  deposit_eur: string;
  kind: "excursion" | "event";
  booking_mode: "departures" | "interest" | "none";
  primary_category: PrimaryCategory | "";
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
    deposit_eur: row?.deposit_eur === null || row?.deposit_eur === undefined ? "" : String(row.deposit_eur),
    kind: row?.kind ?? "excursion",
    booking_mode: row?.booking_mode ?? "departures",
    primary_category: row?.primary_category ?? "",
    cover: row?.cover ?? null,
    gallery: (row?.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => i.media)
      .filter((m): m is MediaRow => Boolean(m)),
  };
}

export function ExcursionForm({ row, initialKind = "excursion" }: { row: ExcursionRow | null; initialKind?: "excursion" | "event" }) {
  const initial = () => (row ? fromRow(row) : { ...fromRow(null), kind: initialKind, booking_mode: initialKind === "event" ? ("interest" as const) : ("departures" as const) });
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial()));
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
      deposit_eur: form.deposit_eur.trim() === "" ? null : form.deposit_eur,
      kind: form.kind,
      booking_mode: form.booking_mode,
      primary_category: form.primary_category || null,
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
        {/* Step 1 + Step 2: what the experience is, and which form visitors get */}
        <Card>
          <h2 className="mb-5 text-lg font-semibold">{t.excursions.sections.setup}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="primary_category" label={t.excursions.sections.step1} hint={L.primaryCategoryHint} error={err("primary_category")}>
              <select
                id="primary_category"
                value={form.primary_category}
                onChange={(e) => set("primary_category", e.target.value as FormState["primary_category"])}
                className="admin-input"
                aria-invalid={Boolean(errors.primary_category) || undefined}
              >
                <option value="">{L.primaryCategoryNone}</option>
                {PRIMARY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {L.primaryCategories[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="kind" label={L.kind}>
              <select id="kind" value={form.kind} onChange={(e) => set("kind", e.target.value as FormState["kind"])} className="admin-input">
                <option value="excursion">{L.kindExcursion}</option>
                <option value="event">{L.kindEventOption}</option>
              </select>
            </Field>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">{t.excursions.sections.step2}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["departures", L.modeDepartures, L.modeDeparturesHint],
                  ["interest", L.modeInterest, L.modeInterestHint],
                  // Legacy only: offered just so an existing "information only" page keeps its setting.
                  ...(form.booking_mode === "none" ? ([["none", L.modeNone, L.modeNoneHint]] as const) : []),
                ] as const
              ).map(([value, label, hint]) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-ink/10 has-[:checked]:bg-emerald-50 has-[:checked]:ring-emerald-600/40">
                  <input type="radio" name="booking_mode" value={value} checked={form.booking_mode === value} onChange={() => set("booking_mode", value)} className="mt-1 accent-emerald-700" />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-bark">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {form.booking_mode !== "none" && (
            <div className="mt-5 rounded-lg border border-dashed border-ink/20 bg-stone/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-bark">{L.formPreview}</p>
              <p className="mt-2 font-semibold">{form.booking_mode === "departures" ? L.previewScheduledTitle : L.previewGeneralTitle}</p>
              <ul className="mt-2 grid gap-1 text-sm text-bark sm:grid-cols-2">
                {(form.booking_mode === "departures" ? L.previewScheduledFields : L.previewGeneralFields).map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden>•</span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-bark">{form.booking_mode === "departures" ? L.previewScheduledNote : L.previewGeneralNote}</p>
            </div>
          )}
          <p className="mt-4 rounded-lg bg-sky-50 p-3 text-xs text-sky-950">
            {form.booking_mode === "departures" ? (row ? L.departuresBelow : L.departuresAfterSave) : L.noDeparturesForGeneral}
          </p>
        </Card>

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
              {/* Remounts per language so each version is edited on its own. */}
              <RichTextEditor
                key={lang}
                id={lf("description")}
                value={form[lf("description")]}
                onChange={(html) => set(lf("description"), html)}
                label={`${L.description} (${lang.toUpperCase()})`}
                describedBy={`${lf("description")}-hint`}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={lf("destination")} label={L.destination} optional>
                <input id={lf("destination")} value={form[lf("destination")]} onChange={(e) => set(lf("destination"), e.target.value)} className="admin-input" />
              </Field>
              <Field id={lf("category")} label={L.category} hint={L.categoryHint} optional>
                <input id={lf("category")} value={form[lf("category")]} onChange={(e) => set(lf("category"), e.target.value)} className="admin-input" />
              </Field>
              <Field id={lf("duration")} label={L.duration} optional>
                <input id={lf("duration")} value={form[lf("duration")]} onChange={(e) => set(lf("duration"), e.target.value)} placeholder={L.durationPlaceholder} className="admin-input" />
              </Field>
              <Field id={lf("difficulty")} label={L.difficulty} optional>
                <input id={lf("difficulty")} value={form[lf("difficulty")]} onChange={(e) => set(lf("difficulty"), e.target.value)} placeholder={L.difficultyPlaceholder} className="admin-input" />
              </Field>
              <Field id={lf("availability_note")} label={L.availabilityNote} optional>
                <input id={lf("availability_note")} value={form[lf("availability_note")]} onChange={(e) => set(lf("availability_note"), e.target.value)} className="admin-input" />
              </Field>
            </div>
            <Field id={lf("meeting_point")} label={L.meetingPoint} optional>
              <input id={lf("meeting_point")} value={form[lf("meeting_point")]} onChange={(e) => set(lf("meeting_point"), e.target.value)} className="admin-input" />
            </Field>
            <Field id={lf("included")} label={L.included} hint={L.includedHint} optional>
              <textarea id={lf("included")} value={form[lf("included")]} onChange={(e) => set(lf("included"), e.target.value)} rows={3} className="admin-input" />
            </Field>
            <Field id={lf("info")} label={L.info} hint={L.infoHint} optional>
              <textarea id={lf("info")} value={form[lf("info")]} onChange={(e) => set(lf("info"), e.target.value)} rows={4} className="admin-input" />
            </Field>
            <Field id={lf("cancellation_policy")} label={L.cancellationPolicy} optional>
              <textarea id={lf("cancellation_policy")} value={form[lf("cancellation_policy")]} onChange={(e) => set(lf("cancellation_policy"), e.target.value)} rows={3} className="admin-input" />
            </Field>
          </div>
        </Card>

        {/* Shared details */}
        <Card>
          <h2 className="mb-5 text-lg font-semibold">{t.excursions.sections.details}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="price_eur" label={L.price} optional error={err("price_eur")}>
              <input
                id="price_eur"
                inputMode="decimal"
                value={form.price_eur}
                onChange={(e) => set("price_eur", e.target.value)}
                placeholder="π.χ. 140"
                className="admin-input"
                aria-invalid={Boolean(errors.price_eur) || undefined}
              />
            </Field>
            <Field id="deposit_eur" label={L.deposit} optional error={err("deposit_eur")}>
              <input
                id="deposit_eur"
                inputMode="decimal"
                value={form.deposit_eur}
                onChange={(e) => set("deposit_eur", e.target.value)}
                placeholder="π.χ. 50"
                className="admin-input"
                aria-invalid={Boolean(errors.deposit_eur) || undefined}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-bark">{L.priceDefaultHint}</p>
          {(form.price_note_el.trim() || form.price_note_en.trim()) && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">{L.legacyPriceNote}</p>
              <ul className="mt-1 space-y-0.5">
                {(["el", "en"] as const).map((l) =>
                  form[`price_note_${l}`].trim() ? (
                    <li key={l}>
                      {l.toUpperCase()}: «{form[`price_note_${l}`]}»
                    </li>
                  ) : null,
                )}
              </ul>
              <p className="mt-1">{L.legacyPriceNoteHint}</p>
            </div>
          )}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field id="participants" label={L.participants} optional>
              <input id="participants" value={form.participants} onChange={(e) => set("participants", e.target.value)} placeholder={L.participantsPlaceholder} className="admin-input" />
            </Field>
          </div>
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
              <a href={previewHref} target="_blank" rel="noopener" className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-deep-teal hover:bg-turquoise/5">
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
              toast("error", errorMessage(res.error) ?? t.common.error);
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
