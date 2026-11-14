import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { getContactDetails } from "@/lib/cms/contact";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BackToTop } from "./BackToTop";
import { Wordmark } from "@/components/ui/Wordmark";

/** Cached at build/revalidation time so the footer stays fully static. */
async function getYear() {
  "use cache";
  return new Date().getFullYear();
}

export async function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  const f = t.footer;
  const year = await getYear();
  const explore = (["activities", "destinations", "news", "about", "gallery", "contact"] as const).map((k) => ({
    href: localePath(locale, routes[k]),
    label: t.nav[k],
  }));
  const contact = await getContactDetails(locale);
  const { email, phone, address } = contact;
  const hasContact = Boolean(email || phone || address);

  return (
    <footer className="relative overflow-hidden border-t border-bone/10 bg-ink pt-24 text-bone">
      <div className="container-x grid gap-14 pb-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Wordmark useLogo className="mb-8 size-24" />
          <p className="font-display text-display-sm max-w-sm text-bone/90">{f.tagline}</p>
          <div className="mt-8">
            <Link
              href={localePath(locale, routes.contact)}
              className="text-eyebrow inline-flex min-h-11 items-center gap-3 text-lichen transition-colors hover:text-bone"
            >
              <span aria-hidden className="h-px w-8 bg-current" />
              {t.nav.inquire}
            </Link>
          </div>
        </div>

        <nav aria-label={f.explore} className="md:col-span-2">
          <h2 className="text-eyebrow mb-5 font-sans text-fog">{f.explore}</h2>
          <ul className="space-y-1">
            {explore.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-10 items-center text-bone/85 transition-colors hover:text-lichen">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-3">
          <h2 className="text-eyebrow mb-5 font-sans text-fog">{f.contactTitle}</h2>
          {hasContact ? (
            <ul className="space-y-2 text-bone/85">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="hover:text-lichen">{email}</a>
                </li>
              )}
              {phone && (
                <li>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-lichen">{phone}</a>
                </li>
              )}
              {address && <li>{address}</li>}
            </ul>
          ) : (
            <p className="max-w-xs text-sm leading-relaxed text-fog">{f.contactPending}</p>
          )}
          <Link
            href={localePath(locale, routes.contact)}
            className="mt-3 inline-flex min-h-10 items-center text-bone/85 underline decoration-bone/30 underline-offset-4 transition-colors hover:text-lichen"
          >
            {f.contactForm}
          </Link>
        </div>

        <div className="md:col-span-2">
          <h2 className="text-eyebrow mb-5 font-sans text-fog">{f.social}</h2>
          <ul className="space-y-1">
            {contact.social.map((s) => (
              <li key={s.key}>
                {s.href ? (
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-bone/85 hover:text-lichen">
                    {s.label}
                  </a>
                ) : (
                  <span className="inline-flex min-h-10 items-center gap-2 text-bone/50">
                    {s.label} <span className="text-xs text-fog">({f.comingSoon})</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <h2 className="text-eyebrow mb-2 mt-8 font-sans text-fog">{f.language}</h2>
          <LanguageSwitcher locale={locale} groupLabel={t.nav.languageGroup} switchLabel={t.nav.switchLanguage} />
        </div>
      </div>

      <div aria-hidden className="container-x select-none overflow-hidden">
        <Wordmark className="block translate-y-[0.18em] text-center text-[clamp(5rem,27vw,26rem)] leading-[0.8] text-bone/[0.07]" />
      </div>

      <div className="border-t border-bone/10">
        <div className="container-x flex flex-col gap-3 py-6 text-xs text-fog sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} OurWay. {f.rights}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={localePath(locale, routes.privacy)} className="inline-flex min-h-10 items-center hover:text-bone">
              {f.privacy}
            </Link>
            <span>{f.photoCredit}</span>
            <BackToTop label={f.backToTop} />
          </div>
        </div>
      </div>
    </footer>
  );
}
