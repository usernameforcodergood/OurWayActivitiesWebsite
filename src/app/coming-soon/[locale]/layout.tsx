import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Manrope, Noto_Serif_Display } from "next/font/google";
import { hasLocale, locales, localeMeta } from "@/i18n/config";
import { siteConfig } from "@/lib/site";
import "../../globals.css";
import "./coming-soon.css";

/**
 * Root layout of the pre-launch Coming Soon page (see src/lib/coming-soon.ts).
 * Deliberately separate from the [locale] layout: no navigation, footer,
 * analytics or cookie banner. Same fonts and design tokens as the site.
 */
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

export async function generateMetadata({ params }: LayoutProps<"/coming-soon/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const el = locale === "el";
  return {
    metadataBase: new URL(siteConfig.url),
    title: el ? "OurWay — Το ταξίδι ξεκινά σύντομα" : "OurWay — The journey begins soon",
    description: el
      ? "Αυθεντικές εμπειρίες, νέοι προορισμοί και περιπέτειες που αξίζει να ζήσεις. Η OurWay ετοιμάζεται να ξεκινήσει το δικό της ταξίδι."
      : "Authentic experiences, new destinations and adventures worth experiencing. OurWay is getting ready to begin its journey.",
    applicationName: siteConfig.name,
    // Pre-launch page: never index it (the proxy also sends X-Robots-Tag).
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b1718",
  colorScheme: "dark",
};

export default async function ComingSoonLayout({ children, params }: LayoutProps<"/coming-soon/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  return (
    <html lang={localeMeta[locale].htmlLang} className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
