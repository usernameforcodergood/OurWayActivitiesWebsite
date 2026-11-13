"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeMeta, type Locale } from "@/i18n/config";
import { switchLocalePath } from "@/i18n/routes";
import { cn } from "@/lib/utils";

type Props = {
  locale: Locale;
  /** Accessible group label, e.g. "Language selection". */
  groupLabel: string;
  /** Accessible label for the other-language link, e.g. "Switch to English". */
  switchLabel: string;
  className?: string;
  onNavigate?: () => void;
};

/**
 * "GR / EN" switcher. The other language is a real link to the same page in
 * that language (paths are shared), so it works without JavaScript too.
 */
export function LanguageSwitcher({ locale, groupLabel, switchLabel, className, onNavigate }: Props) {
  const pathname = usePathname() || `/${locale}`;

  return (
    <nav aria-label={groupLabel} className={cn("flex items-center text-xs font-semibold tracking-[0.18em]", className)}>
      {locales.map((l, i) => {
        const active = l === locale;
        return (
          <span key={l} className="flex items-center">
            {i > 0 && (
              <span aria-hidden className="px-1.5 text-current/40">
                /
              </span>
            )}
            {active ? (
              <span aria-current="true" className="inline-flex min-h-11 min-w-9 items-center justify-center">
                {localeMeta[l].short}
              </span>
            ) : (
              <Link
                href={switchLocalePath(pathname, l)}
                hrefLang={localeMeta[l].htmlLang}
                lang={localeMeta[l].htmlLang}
                aria-label={switchLabel}
                onClick={onNavigate}
                scroll={false}
                className="inline-flex min-h-11 min-w-9 items-center justify-center text-current/55 transition-colors hover:text-current"
              >
                {localeMeta[l].short}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
