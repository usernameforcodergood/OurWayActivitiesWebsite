"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ImagePlus, Images, Loader2, Trash2, Upload, X } from "lucide-react";
import { listMedia } from "../_actions/media";
import { ACCEPT_ATTR, uploadImages } from "../_lib/upload";
import { t, fmt } from "../_lib/strings";
import { useToast } from "./Toast";
import { Btn, btnClass } from "./ui";
import { mediaUrl } from "@/lib/supabase/config";
import type { MediaRow } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

/* ----------------------------- Library dialog ----------------------------- */

function LibraryDialog({
  open,
  multiple,
  onClose,
  onPick,
}: {
  open: boolean;
  multiple: boolean;
  onClose: () => void;
  onPick: (items: MediaRow[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<MediaRow[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setSelected([]);
      listMedia().then((res) => setItems(res.ok ? res.data : []));
    }
    if (!open && d.open) d.close();
  }, [open]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : multiple ? [...s, id] : [id]));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="library-title"
      className="m-auto h-[min(44rem,calc(100dvh-2rem))] w-[min(60rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 id="library-title" className="text-lg font-semibold">
            {t.media.choose}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.media.close} className="rounded-lg p-2 hover:bg-ink/5">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {items === null ? (
            <p className="flex items-center gap-2 text-sm text-bark">
              <Loader2 aria-hidden className="size-4 animate-spin" /> {t.common.loading}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-bark">{t.media.empty}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {items.map((m) => {
                const on = selected.includes(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.id)}
                      aria-pressed={on}
                      aria-label={m.alt_el || m.alt_en || m.path}
                      className={cn(
                        "relative block aspect-square w-full overflow-hidden rounded-lg bg-stone ring-2 transition",
                        on ? "ring-lagoon" : "ring-transparent hover:ring-ink/20",
                      )}
                    >
                      <Image src={mediaUrl(m.path)} alt="" fill sizes="200px" className="object-cover" />
                      {on && (
                        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-lagoon text-white">
                          <Check aria-hidden className="size-4" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-ink/10 px-5 py-4">
          <Btn variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Btn>
          <Btn
            disabled={!selected.length}
            onClick={() => {
              const map = new Map((items ?? []).map((m) => [m.id, m]));
              onPick(selected.map((id) => map.get(id)).filter((m): m is MediaRow => Boolean(m)));
              onClose();
            }}
          >
            {t.media.pick}
          </Btn>
        </div>
      </div>
    </dialog>
  );
}

/* ------------------------------ Upload button ----------------------------- */

function UploadButton({
  multiple,
  label,
  onUploaded,
  variant = "secondary",
}: {
  multiple: boolean;
  label: string;
  onUploaded: (items: MediaRow[]) => void;
  variant?: "primary" | "secondary";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const toast = useToast();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const { uploaded, errors } = await uploadImages(list, (d, total) => setProgress([d, total]));
    setProgress(null);
    if (input.current) input.current.value = "";
    errors.forEach((e) => toast("error", e));
    if (uploaded.length) {
      toast("success", t.media.uploaded);
      onUploaded(uploaded);
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={progress !== null}
        className={btnClass(variant)}
      >
        {progress ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
        {progress ? fmt(t.media.uploading, { done: progress[0], total: progress[1] }) : label}
      </button>
    </>
  );
}

export { UploadButton };

/* ------------------------------ Single image ------------------------------ */

export function SingleImagePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: MediaRow | null;
  onChange: (m: MediaRow | null) => void;
}) {
  const [library, setLibrary] = useState(false);
  return (
    <div>
      <p id={id} className="mb-2 text-sm font-semibold">
        {label} <span className="text-xs font-normal text-bark/80">({t.common.optional})</span>
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-stone sm:w-64">
          {value ? (
            <Image src={mediaUrl(value.path)} alt={value.alt_el || value.alt_en || ""} fill sizes="256px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-bark">
              <ImagePlus aria-hidden className="size-6" />
              {t.media.noImage}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
          <UploadButton multiple={false} label={value ? t.media.replace : t.media.upload} onUploaded={(m) => onChange(m[0])} />
          <Btn variant="secondary" onClick={() => setLibrary(true)}>
            <Images aria-hidden className="size-4" />
            {t.media.choose}
          </Btn>
          {value && (
            <Btn variant="ghost" onClick={() => onChange(null)}>
              <X aria-hidden className="size-4" />
              {t.media.remove}
            </Btn>
          )}
        </div>
      </div>
      <LibraryDialog open={library} multiple={false} onClose={() => setLibrary(false)} onPick={(m) => m[0] && onChange(m[0])} />
    </div>
  );
}

/* --------------------------------- Gallery -------------------------------- */

export function GalleryPicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: MediaRow[];
  onChange: (items: MediaRow[]) => void;
}) {
  const [library, setLibrary] = useState(false);
  const add = (items: MediaRow[]) => {
    const ids = new Set(value.map((v) => v.id));
    onChange([...value, ...items.filter((i) => !ids.has(i.id))]);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = value.slice();
    const [m] = next.splice(i, 1);
    next.splice(i + d, 0, m);
    onChange(next);
  };

  return (
    <div>
      <p id={id} className="mb-2 text-sm font-semibold">
        {label} <span className="text-xs font-normal text-bark/80">({t.common.optional})</span>
      </p>
      {value.length > 0 && (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {value.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-lg bg-white ring-1 ring-ink/10">
              <div className="relative aspect-[4/3] bg-stone">
                <Image src={mediaUrl(m.path)} alt={m.alt_el || m.alt_en || ""} fill sizes="240px" className="object-cover" />
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <span className="px-1 text-xs tabular-nums text-bark">{i + 1}</span>
                <span className="flex">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={t.media.moveUp}
                    className="rounded p-2 hover:bg-ink/5 disabled:opacity-30"
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === value.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={t.media.moveDown}
                    className="rounded p-2 hover:bg-ink/5 disabled:opacity-30"
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x.id !== m.id))}
                    aria-label={t.media.remove}
                    className="rounded p-2 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
        <UploadButton multiple label={t.media.addImages} onUploaded={add} />
        <Btn variant="secondary" onClick={() => setLibrary(true)}>
          <Images aria-hidden className="size-4" />
          {t.media.choose}
        </Btn>
      </div>
      <LibraryDialog open={library} multiple onClose={() => setLibrary(false)} onPick={add} />
    </div>
  );
}
