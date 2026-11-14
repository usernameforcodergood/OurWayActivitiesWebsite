import "server-only";
import type { Locale } from "@/i18n/config";
import { siteConfig } from "@/lib/site";
import { getSiteSettings } from "./public";

export type ContactDetails = {
  email: string;
  phone: string;
  address: string;
  social: Array<{ key: string; label: string; href: string }>;
};

/**
 * Contact details managed in Admin → Settings. Falls back to the defaults in
 * src/lib/site.ts when the database isn't configured yet.
 */
export async function getContactDetails(locale: Locale): Promise<ContactDetails> {
  const s = await getSiteSettings();
  if (!s) {
    return { ...siteConfig.contact, social: siteConfig.social };
  }
  return {
    email: s.email ?? "",
    phone: s.phone ?? "",
    address: (locale === "el" ? s.address_el : s.address_en) ?? "",
    social: [
      { key: "instagram", label: "Instagram", href: s.instagram_url ?? "" },
      { key: "facebook", label: "Facebook", href: s.facebook_url ?? "" },
      { key: "linkedin", label: "LinkedIn", href: s.linkedin_url ?? "" },
    ],
  };
}
