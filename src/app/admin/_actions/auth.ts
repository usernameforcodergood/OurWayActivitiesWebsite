"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAdmin } from "@/lib/auth";

export type LoginState = { error?: "invalid" | "forbidden" | "notConfigured" | "rateLimited" | "generic"; email?: string };

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

/** Only same-site admin paths are allowed as a post-login destination. */
function safeNext(next: string | undefined): string {
  return next && /^\/admin(\/[\w\-/]*)?$/.test(next) && !next.startsWith("/admin/login") ? next : "/admin";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured) return { error: "notConfigured" };
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "invalid", email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    if (error?.status === 429) return { error: "rateLimited", email };
    return { error: error?.status === 400 || error?.code === "invalid_credentials" ? "invalid" : "generic", email };
  }

  // Only listed administrators may continue; everyone else is signed out again.
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "forbidden", email };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export type PasswordResult = { ok: boolean; error?: "short" | "mismatch" | "generic" };

export async function changePassword(_prev: PasswordResult | null, formData: FormData): Promise<PasswordResult> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { ok: false, error: "short" };
  if (password !== confirm) return { ok: false, error: "mismatch" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, error: "generic" } : { ok: true };
}
