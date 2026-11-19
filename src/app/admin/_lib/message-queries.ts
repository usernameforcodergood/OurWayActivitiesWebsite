import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ilikePattern } from "../_components/ListToolbar";
import { PAGE_SIZE } from "./queries";

/** Contact-form messages (public.contact_messages, migration 0008). Admin session + RLS. */
export const MESSAGE_STATUSES = ["new", "in_progress", "closed"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export type ContactMessageRow = {
  id: string;
  reference: string;
  status: MessageStatus;
  name: string;
  email: string;
  phone: string | null;
  interest: string | null;
  preferred_date: string | null;
  participants: number | null;
  message: string;
  locale: "el" | "en";
  created_at: string;
};

export type MessageListParams = { q: string; status: "all" | MessageStatus; page: number };

export function parseMessageParams(sp: Record<string, string | string[] | undefined>): MessageListParams {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = one("status");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").slice(0, 100),
    status: (MESSAGE_STATUSES as readonly string[]).includes(status) ? (status as MessageStatus) : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listMessages(p: MessageListParams) {
  const db = await createSupabaseServerClient();
  let q = db
    .from("contact_messages")
    .select("id, reference, status, name, email, phone, interest, preferred_date, participants, message, locale, created_at", { count: "exact" });
  if (p.status !== "all") q = q.eq("status", p.status);
  if (p.q) {
    const pat = ilikePattern(p.q);
    q = q.or(`name.ilike.${pat},email.ilike.${pat},reference.ilike.${pat},phone.ilike.${pat},interest.ilike.${pat}`);
  }
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) console.error("[admin] list messages:", error.message);
  return {
    rows: (data ?? []) as ContactMessageRow[],
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    /** The table is missing until migration 0008 is applied. */
    unavailable: Boolean(error),
  };
}
