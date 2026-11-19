"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/cms/schemas";

const input = z.object({ id: z.uuid(), status: z.enum(["new", "in_progress", "closed"]) });

/** Changes a contact message's status (admin only; checked again by the database). */
export async function setMessageStatus(values: z.input<typeof input>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = input.safeParse(values);
  if (!parsed.success) return { ok: false, error: "generic" };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("admin_set_contact_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) {
    console.error("[admin] message status:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}
