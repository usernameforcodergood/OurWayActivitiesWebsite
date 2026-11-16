import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { AlertCircle } from "lucide-react";
import { getAdmin } from "@/lib/auth";
import { authStrings, resolveAuthLang, withLang } from "../_lib/auth-strings";
import { RECOVERY_COOKIE } from "../_lib/recovery";
import { AuthPage } from "../_components/AuthPage";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const instant = false;

export async function generateMetadata({ searchParams }: PageProps<"/admin/reset-password">): Promise<Metadata> {
  const lang = resolveAuthLang((await searchParams).lang);
  return { title: authStrings[lang].reset.metaTitle, referrer: "no-referrer" };
}

/**
 * Landing page of the emailed reset link:
 *   /admin/reset-password?token_hash=…&type=recovery
 * Opening the link does NOT consume the token (so email link scanners can't
 * burn it); it is verified only when the administrator submits a new password.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  const sp = await searchParams;
  const lang = resolveAuthLang(sp.lang);
  const s = authStrings[lang].reset;

  const tokenHash = typeof sp.token_hash === "string" && sp.type === "recovery" ? sp.token_hash : undefined;
  const providerError = Boolean(sp.error || sp.error_code);

  let verified = false;
  if (!tokenHash) {
    const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
    if (marker) {
      const admin = await getAdmin();
      verified = admin.status === "admin" && admin.id === marker;
    }
  }

  const valid = !providerError && (Boolean(tokenHash) || verified);
  const path = tokenHash ? `/admin/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery` : "/admin/reset-password";

  return (
    <AuthPage lang={lang} path={path} title={valid ? s.title : s.invalidTitle} subtitle={valid ? s.intro : undefined}>
      {valid ? (
        <ResetPasswordForm lang={lang} tokenHash={tokenHash} verified={verified} />
      ) : (
        <div className="space-y-5">
          <p role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {s.invalidLink}
          </p>
          <Link
            href={withLang("/admin/forgot-password", lang)}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-forest px-4 py-2.5 font-semibold text-bone transition hover:bg-moss"
          >
            {s.requestNew}
          </Link>
          <div className="text-center">
            <Link href={withLang("/admin/login", lang)} className="text-sm font-semibold text-forest underline-offset-4 hover:underline">
              {s.back}
            </Link>
          </div>
        </div>
      )}
    </AuthPage>
  );
}
