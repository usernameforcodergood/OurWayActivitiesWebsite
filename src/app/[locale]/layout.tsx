import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { Manrope, Noto_Serif_Display } from "next/font/google";
import { hasLocale, locales, localeMeta } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { siteConfig } from "@/lib/site";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import "../globals.css";

const display = Noto_Serif_Display({
  subsets: ["latin", "greek"],
  variable: "--font-noto-serif-display",
  axes: ["wdth"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin", "greek"],
  variable: "--font-manrope",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: t.meta.defaultTitle, template: t.meta.titleTemplate },
    description: t.meta.description,
    applicationName: siteConfig.name,
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0c1311",
  colorScheme: "dark",
};

/** Adds `js-motion` before first paint when motion is allowed, so elements
 *  that GSAP reveals can start hidden without a flash of visible content. */
const motionScript = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js-motion')}catch(e){}`;

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);

  return (
    <html lang={localeMeta[locale].htmlLang} className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <Script id="motion-pref" strategy="beforeInteractive">
          {motionScript}
        </Script>
        <a
          href="#main"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-sand px-5 py-3 text-sm font-semibold text-ink transition-transform focus:translate-y-0"
        >
          {t.nav.skip}
        </a>
        <SmoothScroll />
        <Navbar locale={locale} t={t.nav} />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer locale={locale} t={t} />
      </body>
    </html>
  );
}
