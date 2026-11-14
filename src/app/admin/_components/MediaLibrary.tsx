"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteMedia, updateMediaAlt } from "../_actions/media";
import { fmt, t } from "../_lib/strings";
import { mediaUrl } from "@/lib/supabase/config";
import type { MediaRow } from "@/lib/cms/types";
import { useToast } from "./Toast";
import { UploadButton } from "./MediaPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { Btn, EmptyState, formatDate } from "./ui";

type Item = MediaRow & { usage: number };

function MediaCard({ item }: { item: Item }) {
  const router = useRouter();
  const toast = useToast();
  const [altEl, setAltEl] = useState(item.alt_el ?? "");
  const [altEn, setAltEn] = useState(item.alt_en ?? "");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = altEl !== (item.alt_el ?? "") || altEn !== (item.alt_en ?? "");

  return (
    <li className="admin-card overflow-hidden">
      <div className="relative aspect-[4/3] bg-stone">
        <Image src={mediaUrl(item.path)} alt={item.alt_el || item.alt_en || ""} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
      </div>
      <div className="space-y-3 p-4">
        <p className="flex flex-wrap justify-between gap-2 text-xs text-bark">
          <span>{item.width && item.height ? fmt(t.media.dimensions, { w: item.width, h: item.height }) : ""}</span>
          <span>{formatDate(item.created_at)}</span>
        </p>
        <p className={item.usage ? "text-xs font-medium text-emerald-800" : "text-xs text-bark"}>
          {item.usage ? fmt(t.media.inUse, { count: item.usage }) : t.media.unused}
        </p>
        <div>
          <label htmlFor={`alt-el-${item.id}`} className="mb-1 block text-xs font-semibold">
            {t.media.altEl}
          </label>
          <input id={`alt-el-${item.id}`} value={altEl} onChange={(e) => setAltEl(e.target.value)} maxLength={300} className="admin-input py-1.5 text-sm" />
        </div>
        <div>
          <label htmlFor={`alt-en-${item.id}`} className="mb-1 block text-xs font-semibold">
            {t.media.altEn}
          </label>
          <input id={`alt-en-${item.id}`} lang="en" value={altEn} onChange={(e) => setAltEn(e.target.value)} maxLength={300} className="admin-input py-1.5 text-sm" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Btn
            variant="secondary"
            className="min-h-9 px-3"
            disabled={!dirty || pending}
            onClick={() =>
              start(async () => {
                const res = await updateMediaAlt(item.id, altEl, altEn);
                toast(res.ok ? "success" : "error", res.ok ? t.common.saved : t.common.error);
                if (res.ok) router.refresh();
              })
            }
          >
            {pending ? t.common.saving : t.common.save}
          </Btn>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label={t.common.delete}
            title={t.common.delete}
            className="rounded-lg p-2 text-red-700 hover:bg-red-50"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t.common.confirmDeleteTitle}
        body={item.usage ? `${t.media.deleteWarning} ${fmt(t.media.inUse, { count: item.usage })}.` : fmt(t.common.confirmDeleteBody, { name: item.alt_el || item.alt_en || "εικόνα" })}
        busy={deleting}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setDeleting(true);
          const res = await deleteMedia(item.id);
          setDeleting(false);
          setConfirm(false);
          toast(res.ok ? "success" : "error", res.ok ? t.common.deleted : t.common.error);
          if (res.ok) router.refresh();
        }}
      />
    </li>
  );
}

export function MediaLibrary({ items }: { items: Item[] }) {
  const router = useRouter();
  return (
    <>
      <div className="mb-6">
        <UploadButton multiple variant="primary" label={t.media.upload} onUploaded={() => router.refresh()} />
      </div>
      {items.length === 0 ? (
        <EmptyState title={t.media.empty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => (
            <MediaCard key={m.id} item={m} />
          ))}
        </ul>
      )}
    </>
  );
}
