"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRequestNote } from "../_actions/bookings";
import { t } from "../_lib/strings";
import { useToast } from "./Toast";
import { Btn, Card, formatDate } from "./ui";

/** Internal admin notes. Never shown to customers or included in emails. */
export function NotesPanel({
  target,
  id,
  notes,
}: {
  target: "booking" | "private";
  id: string;
  notes: Array<{ id: number; body: string; created_at: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const B = t.bookings;

  return (
    <Card>
      <h2 className="text-lg font-semibold">{B.notes}</h2>
      <p className="mb-4 text-xs text-bark">{B.notesHint}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          start(async () => {
            const res = await addRequestNote({ target, id, body });
            if (!res.ok) {
              toast("error", t.common.error);
              return;
            }
            setBody("");
            toast("success", B.noteAdded);
            router.refresh();
          });
        }}
      >
        <label htmlFor="note-body" className="sr-only">
          {B.addNote}
        </label>
        <textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} className="admin-input" />
        <Btn type="submit" variant="secondary" className="mt-2" disabled={pending || !body.trim()}>
          {pending ? t.common.saving : B.addNote}
        </Btn>
      </form>
      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-bark">{B.notesEmpty}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-stone/50 p-3">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-1 text-xs text-bark">{formatDate(n.created_at, true)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
