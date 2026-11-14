"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { deleteExcursion, setExcursionStatus } from "../_actions/excursions";
import { deleteAnnouncement, setAnnouncementStatus } from "../_actions/announcements";
import { errorMessage, fmt, t } from "../_lib/strings";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";
import { btnClass } from "./ui";

type Props = {
  kind: "excursion" | "announcement";
  id: string;
  status: "draft" | "published";
  name: string;
  editHref: string;
  publicHref?: string;
};

/** Edit / publish toggle / view / delete for one list row. */
export function RowActions({ kind, id, status, name, editHref, publicHref }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const strings = kind === "excursion" ? t.excursions : t.announcements;

  const toggle = () =>
    start(async () => {
      const next = status === "published" ? "draft" : "published";
      const res = kind === "excursion" ? await setExcursionStatus(id, next) : await setAnnouncementStatus(id, next);
      if (!res.ok) {
        toast("error", errorMessage(res.error) ?? t.common.error);
        return;
      }
      toast("success", next === "published" ? strings.published : strings.unpublished);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
      <Link href={editHref} className={btnClass("secondary", "min-h-9 px-3")}>
        <Pencil aria-hidden className="size-3.5" />
        {t.common.edit}
      </Link>
      <button type="button" onClick={toggle} disabled={pending} className={btnClass(status === "published" ? "secondary" : "publish", "min-h-9 px-3")}>
        {status === "published" ? t.common.unpublish : t.common.publish}
      </button>
      {publicHref && (
        <a href={publicHref} target="_blank" rel="noopener" className={btnClass("ghost", "min-h-9 px-2.5")} aria-label={t.common.viewOnSite} title={t.common.viewOnSite}>
          <ExternalLink aria-hidden className="size-4" />
        </a>
      )}
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className={btnClass("ghost", "min-h-9 px-2.5 text-red-700 hover:bg-red-50")}
        aria-label={`${t.common.delete}: ${name}`}
        title={t.common.delete}
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
      <ConfirmDialog
        open={confirm}
        title={t.common.confirmDeleteTitle}
        body={fmt(t.common.confirmDeleteBody, { name })}
        busy={deleting}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setDeleting(true);
          const res = kind === "excursion" ? await deleteExcursion(id) : await deleteAnnouncement(id);
          setDeleting(false);
          setConfirm(false);
          if (!res.ok) {
            toast("error", t.common.error);
            return;
          }
          toast("success", t.common.deleted);
          router.refresh();
        }}
      />
    </div>
  );
}
