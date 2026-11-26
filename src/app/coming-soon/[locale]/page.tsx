import { notFound } from "next/navigation";
import { hasLocale, locales, localeMeta, type Locale } from "@/i18n/config";
import { siteConfig } from "@/lib/site";
import { Wordmark } from "@/components/ui/Wordmark";
import { BackgroundVideo } from "./BackgroundVideo";

/** Pre-launch Coming Soon page (see src/lib/coming-soon.ts). */
const LAUNCH_LABEL = "Coming Soon · 2027";
const TAGLINE = "The journey begins soon.";

const copy: Record<
  Locale,
  { headline: string; body: string; languageGroup: string; switchTo: string; contact: string }
> = {
  el: {
    headline: "Ετοιμάζουμε κάτι ξεχωριστό.",
    body: "Αυθεντικές εμπειρίες, νέοι προορισμοί και περιπέτειες που αξίζει να ζήσεις. Το OurWay ετοιμάζεται να ξεκινήσει το δικό του ταξίδι.",
    languageGroup: "Επιλογή γλώσσας",
    switchTo: "Switch to English",
    contact: "Επικοινωνία",
  },
  en: {
    headline: "We're preparing something special.",
    body: "Authentic experiences, new destinations and adventures worth experiencing. OurWay is getting ready to begin its journey.",
    languageGroup: "Language selection",
    switchTo: "Αλλαγή σε Ελληνικά",
    contact: "Contact",
  },
};

export default async function ComingSoonPage({ params }: PageProps<"/coming-soon/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = copy[locale];
  const { email, phone } = siteConfig.contact;
  const social = siteConfig.social.filter((s) => s.href && s.key !== "linkedin");

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-ink text-bone">
      {/* Background: OurWay's own footage from Kissavos, poster first, slow drift. */}
      <div aria-hidden className="grain absolute inset-0 -z-10">
        <BackgroundVideo
          poster="/videos/experiences-kissavos-poster.jpg"
          src="/videos/experiences-kissavos-1280.mp4"
          mobileSrc="/videos/experiences-kissavos-864.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/35 to-ink/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(11,23,24,0.55)_75%)]" />
      </div>

      {/* Top bar: logo + language switch (same GR / EN pattern as the site). */}
      <header className="container-x cs-rise flex items-center justify-between pt-5 sm:pt-7" style={{ animationDelay: "0.1s" }}>
        <Wordmark useLogo className="size-14 sm:size-16" />
        <nav aria-label={t.languageGroup} className="flex items-center text-xs font-semibold tracking-[0.18em]">
          {locales.map((l, i) => (
            <span key={l} className="flex items-center">
              {i > 0 && (
                <span aria-hidden className="px-1.5 text-bone/40">
                  /
                </span>
              )}
              {l === locale ? (
                <span aria-current="true" className="inline-flex min-h-11 min-w-9 items-center justify-center">
                  {localeMeta[l].short}
                </span>
              ) : (
                <a
                  href={`/${l}`}
                  hrefLang={localeMeta[l].htmlLang}
                  lang={localeMeta[l].htmlLang}
                  aria-label={t.switchTo}
                  className="inline-flex min-h-11 min-w-9 items-center justify-center text-bone/55 transition-colors hover:text-bone"
                >
                  {localeMeta[l].short}
                </a>
              )}
            </span>
          ))}
        </nav>
      </header>

      <main className="container-x flex flex-1 flex-col items-center justify-center py-14 text-center sm:py-20">
        <p className="text-eyebrow cs-rise flex items-center gap-4 text-lichen" style={{ animationDelay: "0.3s" }}>
          <span aria-hidden className="cs-line block h-px w-8 bg-turquoise sm:w-14" />
          {LAUNCH_LABEL}
          <span aria-hidden className="cs-line cs-line-r block h-px w-8 bg-turquoise sm:w-14" />
        </p>

        <h1 className="mt-7 sm:mt-9">
          <span className="cs-title block font-display text-[clamp(3.4rem,15vw,11rem)] leading-[0.9] uppercase" lang="en">
            Our<span className="italic text-turquoise">Way</span>
          </span>
          <span
            className="cs-rise mt-5 block font-sans text-[clamp(0.8rem,1.6vw,1.05rem)] font-semibold uppercase tracking-[0.34em] text-bone/90 sm:mt-7"
            style={{ animationDelay: "0.9s" }}
            lang="en"
          >
            {TAGLINE}
          </span>
        </h1>

        <span aria-hidden className="cs-rise mt-10 block h-10 w-px bg-gradient-to-b from-transparent via-mint to-transparent sm:mt-12" style={{ animationDelay: "1.1s" }} />

        <h2 className="text-display-sm cs-rise mt-8 italic text-bone sm:mt-10" style={{ animationDelay: "1.25s" }}>
          {t.headline}
        </h2>
        <p className="text-lead cs-rise mt-5 max-w-2xl text-bone/75" style={{ animationDelay: "1.4s" }}>
          {t.body}
        </p>
      </main>

      {(email || phone || social.length > 0) && (
        <footer className="container-x cs-rise pb-6 sm:pb-8" style={{ animationDelay: "1.6s" }}>
          <div className="flex flex-col items-center gap-3 border-t border-bone/15 pt-5 text-sm text-bone/70 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8">
            <h3 className="text-eyebrow font-sans text-fog">{t.contact}</h3>
            {email && (
              <a href={`mailto:${email}`} className="break-all transition-colors hover:text-turquoise">
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="transition-colors hover:text-turquoise">
                {phone}
              </a>
            )}
            {social.map((s) => (
              <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-turquoise">
                {s.label}
              </a>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
