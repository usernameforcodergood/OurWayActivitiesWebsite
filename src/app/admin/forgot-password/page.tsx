import type { Metadata } from "next";
import { authStrings, resolveAuthLang } from "../_lib/auth-strings";
import { AuthPage } from "../_components/AuthPage";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const instant = false;

export async function generateMetadata({ searchParams }: PageProps<"/admin/forgot-password">): Promise<Metadata> {
  const lang = resolveAuthLang((await searchParams).lang);
  return { title: authStrings[lang].forgot.metaTitle };
}

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/admin/forgot-password">) {
  const lang = resolveAuthLang((await searchParams).lang);
  const s = authStrings[lang].forgot;
  return (
    <AuthPage lang={lang} path="/admin/forgot-password" title={s.title} subtitle={s.intro}>
      <ForgotPasswordForm lang={lang} />
    </AuthPage>
  );
}
