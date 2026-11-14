/**
 * Site-wide configuration. Company contact details are intentionally empty
 * until OurWay confirms them — components hide anything left blank.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

type SiteConfig = {
  name: string;
  url: string;
  logo: { src: string; width: number; height: number };
  tagline: string;
  contact: { email: string; phone: string; address: string };
  social: Array<{ key: string; label: string; href: string }>;
};

export const siteConfig: SiteConfig = {
  name: "OurWay",
  url: resolveSiteUrl(),
  /**
   * Official logo. Save the file (transparent PNG or SVG) to /public/brand/
   * and set `src`, e.g. "/brand/ourway-logo.png", plus its real width/height.
   * While empty, a typographic wordmark is shown instead.
   */
  // Current file: 1200×1200 WebP on white (from OurWay's 2000px original),
  // shown as a round badge. Favicons: src/app/icon.png and apple-icon.png.
  logo: { src: "/brand/ourway-logo.webp", width: 1200, height: 1200 },
  /** From the official logo. */
  tagline: "Alternative Experiences",
  /** From OurWay's public Facebook page (Nov 2026). Empty values are not rendered. */
  contact: { email: "ourway.activities@gmail.com", phone: "+30 693 232 5160", address: "" },
  /** Profiles listed on the Facebook page. Empty href renders as a "coming soon" placeholder. */
  social: [
    { key: "instagram", label: "Instagram", href: "https://www.instagram.com/ourway.activities/" },
    { key: "facebook", label: "Facebook", href: "https://www.facebook.com/Ourway.activities/" },
    { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/ourway-activities-8b4055310" },
  ],
};
