"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2, Wand2 } from "lucide-react";
import { deleteAnnouncement, saveAnnouncement } from "../_actions/announcements";
import { errorMessage, fmt, t } from "../_lib/strings";
import { athensInputToIso, isoToAthensInput } from "../_lib/athens-time";
import { slugify } from "@/lib/cms/mappers";
import type { AnnouncementRow, MediaRow } from "@/lib/cms/types";
import { useToast } from "./Toast";
import { Field, Toggle } from "./Field";
import { LangTabs, type Lang } from "./LangTabs";
import { SingleImagePicker } from "./MediaPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { Btn, Card, StatusBadge, formatDate } from "./ui";

type FormState = {
  slug: string;
  featured: boolean;
  image: MediaRow | null;
  publish_at: string; // Athens datetime-local; empty = now
  expires_at: string;
  title_el: string;
  title_en: string;
  summary_el: string;
  summary_en: string;
  body_el: string;
  body_en: string;
};

function fromRow(row: AnnouncementRow | null): FormState {
  return {
    slug: row?.slug ?? "",
    featured: row?.featured ?? false,
    image: row?.image ?? null,
    publish_at: isoToAthensInput(row?.publish_at),
    expires_at: isoToAthensInput(row?.expires_at),
    title_el: row?.title_el ?? "",
    title_en: row?.title_en ?? "",
    summary_el: row?.summary_el ?? "",
    summary_en: row?.summary_en ?? "",
    body_el: row?.body_el ?? "",
    body_en: row?.body_en ?? "",
  };
}

export function AnnouncementForm({ row }: { row: AnnouncementRow | null }) {
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

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (!slugTouched && (key === "title_el" || key === "title_en")) next.slug = slugify(String(next.title_el || next.title_en));
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
    start(async () => {
      const res = await saveAnnouncement({
        id: row?.id,
        slug: form.slug.trim(),
        status: nextStatus,
        featured: form.featured,
        image_media_id: form.image?.id ?? null,
        title_el: form.title_el,
        title_en: form.title_en,
        summary_el: form.summary_el,
        summary_en: form.summary_en,
        body_el: form.body_el,
        body_en: form.body_en,
        publish_at: athensInputToIso(form.publish_at) ?? new Date().toISOString(),
        expires_at: athensInputToIso(form.expires_at),
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
      if (!row) router.replace(`/admin/announcements/${res.data.id}`);
      else router.refresh();
    });
  };

  const err = (k: string) => errorMessage(errors[k]);
  const L = t.announcements.fields;
  const k = <P extends "title" | "summary" | "body">(p: P) => `${p}_${lang}` as `${P}_${Lang}`;
  const previewLang = complete.el || !complete.en ? "el" : "en";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t.excursions.sections.content}</h2>
            <LangTabs value={lang} onChange={setLang} complete={complete} />
          </div>
          <p className="mb-5 rounded-lg bg-sky-50 p-3 text-xs text-sky-950">{t.excursions.languageNote}</p>
          <div role="tabpanel" id={`panel-${lang}`} aria-labelledby={`tab-${lang}`} lang={lang} className="grid gap-5">
            <Field id={k("title")} label={L.title} error={err(k("title"))}>
              <input id={k("title")} value={form[k("title")]} onChange={(e) => set(k("title"), e.target.value)} className="admin-input text-base" maxLength={200} aria-invalid={Boolean(errors[k("title")]) || undefined} />
            </Field>
            <Field id={k("summary")} label={L.summary} error={err(k("summary"))}>
              <textarea id={k("summary")} value={form[k("summary")]} onChange={(e) => set(k("summary"), e.target.value)} rows={2} maxLength={600} className="admin-input" aria-invalid={Boolean(errors[k("summary")]) || undefined} />
            </Field>
            <Field id={k("body")} label={L.body} hint={L.bodyHint} optional>
              <textarea id={k("body")} value={form[k("body")]} onChange={(e) => set(k("body"), e.target.value)} rows={10} className="admin-input" />
            </Field>
          </div>
        </Card>
        <Card>
          <SingleImagePicker id="image" label={L.image} value={form.image} onChange={(m) => set("image", m)} />
        </Card>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.excursions.sections.publishing}</h2>
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-bark">{t.excursions.fields.status}</span>
            <StatusBadge status={status} />
          </div>
          {dirty && <p className="mb-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">{t.common.unsavedChanges}</p>}
          <div className="flex flex-col gap-2">
            {status === "published" ? (
              <>
                <Btn variant="publish" disabled={pending} onClick={() => submit("published", t.common.saved)}>
                  {pending ? t.common.saving : t.common.update}
                </Btn>
                <Btn variant="secondary" disabled={pending} onClick={() => submit("draft", t.announcements.unpublished)}>
                  {t.common.unpublish}
                </Btn>
              </>
            ) : (
              <>
                <Btn variant="publish" disabled={pending} onClick={() => submit("published", t.announcements.published)}>
                  {pending ? t.common.saving : t.common.publish}
                </Btn>
                <Btn variant="secondary" disabled={pending} onClick={() => submit("draft", row ? t.common.saved : t.announcements.created)}>
                  {t.common.saveDraft}
                </Btn>
              </>
            )}
            {row && (
              <a href={`/${previewLang}/preview/announcements/${row.id}`} target="_blank" rel="noopener" className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-lagoon hover:bg-lagoon/5">
                <Eye aria-hidden className="size-4" />
                {t.common.preview}
              </a>
            )}
          </div>

          <div className="mt-6 space-y-4 border-t border-ink/10 pt-5">
            <Field id="publish_at" label={`${L.publishAt} (ώρα Ελλάδας)`} hint={L.publishAtHint} error={err("publish_at")}>
              <input id="publish_at" type="datetime-local" value={form.publish_at} onChange={(e) => set("publish_at", e.target.value)} className="admin-input" />
            </Field>
            <Field id="expires_at" label={L.expiresAt} hint={L.expiresAtHint} optional error={err("expires_at")}>
              <input id="expires_at" type="datetime-local" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} className="admin-input" aria-invalid={Boolean(errors.expires_at) || undefined} />
            </Field>
            <Field id="slug" label={t.excursions.fields.slug} hint={t.excursions.fields.slugHint} error={err("slug")}>
              <div className="flex gap-2">
                <input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase());
                  }}
                  className="admin-input font-mono text-sm"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.slug) || undefined}
                />
                <button
                  type="button"
                  onClick={() => set("slug", slugify(form.title_el || form.title_en))}
                  aria-label={t.excursions.fields.generateSlug}
                  title={t.excursions.fields.generateSlug}
                  className="rounded-lg px-2.5 ring-1 ring-ink/15 hover:bg-stone/60"
                >
                  <Wand2 aria-hidden className="size-4" />
                </button>
              </div>
            </Field>
            <p className="break-all text-xs text-bark">/el/news/{form.slug || "…"}</p>
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
            const res = await deleteAnnouncement(row.id);
            setDeleting(false);
            if (!res.ok) {
              toast("error", t.common.error);
              return;
            }
            setSaved(JSON.stringify(form));
            toast("success", t.common.deleted);
            router.replace("/admin/announcements");
          }}
        />
      )}
    </div>
  );
}
