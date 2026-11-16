import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { authStrings, withLang, type AuthLang } from "../_lib/auth-strings";

/**
 * Shared frame for the signed-out admin pages (login, forgot / reset
 * password): logo, title, EL/EN switch and a white card.
 */
export function AuthPage({
  lang,
  path,
  title,
  subtitle,
  children,
}: {
  lang: AuthLang;
  /** Current path, used for the language switch links. */
  path: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main lang={lang} className="relative flex min-h-dvh items-center justify-center bg-forest px-4 py-12">
      <nav aria-label={authStrings[lang].langLabel} className="absolute right-4 top-4 flex gap-1 text-xs font-semibold">
        {(["el", "en"] as const).map((l) => (
          <Link
            key={l}
            href={withLang(path, l)}
            hrefLang={l}
            lang={l}
            aria-current={l === lang ? "true" : undefined}
            className={
              l === lang
                ? "rounded-md bg-bone/15 px-2 py-1 text-bone"
                : "rounded-md px-2 py-1 text-fog transition hover:text-bone"
            }
          >
            {l === "el" ? "EL" : "EN"}
          </Link>
        ))}
      </nav>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center text-bone">
          {siteConfig.logo.src && (
            <span className="mb-5 block size-20 overflow-hidden rounded-full bg-white">
              <Image src={siteConfig.logo.src} alt="OurWay" width={160} height={160} className="size-full object-contain" priority />
            </span>
          )}
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-fog">{subtitle}</p>}
        </div>
        <div className="admin-card p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
