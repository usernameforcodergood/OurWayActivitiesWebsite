import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authStrings, resolveAuthLang } from "../_lib/auth-strings";
import { AuthPage } from "../_components/AuthPage";
import { LoginForm } from "./LoginForm";

export const instant = false;

export async function generateMetadata({ searchParams }: PageProps<"/admin/login">): Promise<Metadata> {
  const lang = resolveAuthLang((await searchParams).lang);
  return { title: authStrings[lang].login.title };
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const lang = resolveAuthLang(sp.lang);
  const s = authStrings[lang].login;
  const admin = await getAdmin();
  if (admin.status === "admin") redirect("/admin");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const initialError =
    !isSupabaseConfigured ? "notConfigured" : sp.error === "forbidden" || admin.status === "forbidden" ? "forbidden" : undefined;

  return (
    <AuthPage lang={lang} path="/admin/login" title={s.title} subtitle={s.subtitle}>
      <LoginForm lang={lang} next={next} initialError={initialError} resetSuccess={sp.reset === "success"} />
    </AuthPage>
  );
}
