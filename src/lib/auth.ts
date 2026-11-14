import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AdminSession = { id: string; email: string };

/**
 * Authoritative server-side check (Data Access Layer). Verifies the session
 * with Supabase Auth (getUser hits the auth server) and confirms the user is
 * listed in public.admin_users. Deduplicated per request.
 */
export const getAdmin = cache(async (): Promise<{ status: "anonymous" | "forbidden" } | ({ status: "admin" } & AdminSession)> => {
  // Always request-time: admin pages must never be prerendered or cached.
  await connection();
  if (!isSupabaseConfigured) return { status: "anonymous" };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };
  const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) return { status: "forbidden" };
  return { status: "admin", id: user.id, email: user.email ?? "" };
});

/** Use at the top of every admin page, layout and Server Action. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (admin.status !== "admin") redirect(admin.status === "forbidden" ? "/admin/login?error=forbidden" : "/admin/login");
  return { id: admin.id, email: admin.email };
}
