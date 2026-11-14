import type { Locale } from "@/i18n/config";

export type ContentStatus = "draft" | "published";

/** Row of public.media */
export type MediaRow = {
  id: string;
  path: string;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  alt_el: string | null;
  alt_en: string | null;
  created_at: string;
};

/** Row of public.excursions (+ optional joined media) */
export type ExcursionRow = {
  id: string;
  slug: string;
  status: ContentStatus;
  featured: boolean;
  cover_media_id: string | null;
  title_el: string | null;
  title_en: string | null;
  summary_el: string | null;
  summary_en: string | null;
  description_el: string | null;
  description_en: string | null;
  destination_el: string | null;
  destination_en: string | null;
  category_el: string | null;
  category_en: string | null;
  duration_el: string | null;
  duration_en: string | null;
  difficulty_el: string | null;
  difficulty_en: string | null;
  participants: string | null;
  price_eur: number | string | null;
  price_note_el: string | null;
  price_note_en: string | null;
  available_dates: string[];
  availability_note_el: string | null;
  availability_note_en: string | null;
  info_el: string | null;
  info_en: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  cover?: MediaRow | null;
  images?: Array<{ position: number; media: MediaRow | null }>;
};

/** Row of public.announcements (+ optional joined image) */
export type AnnouncementRow = {
  id: string;
  slug: string;
  status: ContentStatus;
  featured: boolean;
  image_media_id: string | null;
  title_el: string | null;
  title_en: string | null;
  summary_el: string | null;
  summary_en: string | null;
  body_el: string | null;
  body_en: string | null;
  publish_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  image?: MediaRow | null;
};

export type SiteSettingsRow = {
  email: string | null;
  phone: string | null;
  address_el: string | null;
  address_en: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
};

/* ------------------------------------------------------------------------- */
/* Public, already-localised shapes                                           */
/* ------------------------------------------------------------------------- */

export type CmsImage = { src: string; width: number; height: number; alt: string };

export type PublicExcursion = {
  slug: string;
  featured: boolean;
  /** Languages in which this excursion is complete (title + summary). */
  locales: Locale[];
  title: string;
  summary: string;
  description: string[];
  destination?: string;
  category?: string;
  duration?: string;
  difficulty?: string;
  participants?: string;
  priceEur?: number;
  priceNote?: string;
  availableDates: string[];
  availabilityNote?: string;
  info: string[];
  cover: CmsImage | null;
  gallery: CmsImage[];
  publishedAt: string | null;
  updatedAt: string;
};

export type PublicAnnouncement = {
  slug: string;
  featured: boolean;
  locales: Locale[];
  title: string;
  summary: string;
  body: string[];
  image: CmsImage | null;
  publishAt: string;
  expiresAt: string | null;
  updatedAt: string;
};
