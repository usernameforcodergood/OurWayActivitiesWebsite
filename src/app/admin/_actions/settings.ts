"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TAGS } from "@/lib/cms/public";
import { issuesToFields, settingsSchema, type ActionResult, type SettingsInput } from "@/lib/cms/schemas";

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: issuesToFields(parsed.error.issues) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("site_settings").update(parsed.data).eq("id", 1);
  if (error) return { ok: false, error: "generic" };
  updateTag(TAGS.settings);
  return { ok: true };
}
