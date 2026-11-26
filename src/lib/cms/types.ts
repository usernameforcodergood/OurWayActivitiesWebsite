import type { Locale } from "@/i18n/config";
import type { BookingMode, DepartureStatus } from "@/lib/bookings/validation";

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
  /** Deposit per person (migration 0009). Undefined on databases without it. */
  deposit_eur?: number | string | null;
  /** Legacy free-text note: kept in the DB, no longer edited or shown publicly. */
  price_note_el: string | null;
  price_note_en: string | null;
  available_dates: string[];
  availability_note_el: string | null;
  availability_note_en: string | null;
  info_el: string | null;
  info_en: string | null;
  kind: ExcursionKind;
  booking_mode: BookingMode;
  /** Null for rows saved before migration 0006 (or never categorised). */
  primary_category?: PrimaryCategory | null;
  meeting_point_el: string | null;
  meeting_point_en: string | null;
  included_el: string | null;
  included_en: string | null;
  cancellation_policy_el: string | null;
  cancellation_policy_en: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  cover?: MediaRow | null;
  images?: Array<{ position: number; media: MediaRow | null }>;
  departures?: DepartureRow[];
};

export type ExcursionKind = "excursion" | "event";
export type { BookingMode, DepartureStatus };

/** Primary format category (migration 0006): Day Trips, Two-Day Trips, Packages. */
export const PRIMARY_CATEGORIES = ["day_trip", "two_day", "package"] as const;
export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[number];

/** Row of public.departures */
export type DepartureRow = {
  id: string;
  excursion_id: string;
  departure_date: string;
  departure_time: string | null;
  return_time: string | null;
  /** Last day of a multi-day run (migration 0010). Null = same day. */
  return_date?: string | null;
  price_eur: number | string | null;
  /** Deposit per person for this run (0010). Null = the excursion's deposit. */
  deposit_eur?: number | string | null;
  capacity: number | null;
  min_participants: number | null;
  booking_deadline: string | null;
  status: DepartureStatus;
  note_el: string | null;
  note_en: string | null;
  created_at: string;
  updated_at: string;
};

/** Effective, visitor-facing state of a departure. */
export type DepartureState = "open" | "full" | "closed" | "cancelled" | "completed" | "past";

/** One departure as the public booking form sees it (live counts, no personal data). */
export type PublicDeparture = {
  id: string;
  date: string;
  time: string | null;
  returnTime: string | null;
  returnDate: string | null;
  priceEur: number | null;
  /** Effective deposit per person: the run's own, else the excursion's. */
  depositEur: number | null;
  capacity: number | null;
  minParticipants: number | null;
  /** null = no capacity limit */
  remaining: number | null;
  deadline: string | null;
  state: DepartureState;
  noteEl: string | null;
  noteEn: string | null;
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
  id: string;
  slug: string;
  kind: ExcursionKind;
  bookingMode: BookingMode;
  meetingPoint?: string;
  included: string[];
  cancellationPolicy: string[];
  /** Upcoming departures (dates, times, prices). Live places come from /api/availability. */
  departures: Array<{ id: string; date: string; time: string | null; priceEur: number | null; status: DepartureStatus }>;
  /**
   * Days that can still be requested (open runs with places), soonest first.
   * [] = none right now ("on request"); null = not applicable or unknown.
   * Filled by getPublishedExcursions(); null elsewhere.
   */
  availableDates: string[] | null;
  featured: boolean;
  /** Languages in which this excursion is complete (title + summary). */
  locales: Locale[];
  title: string;
  summary: string;
  /** Editor HTML or older plain text — render only through <RichText>, which sanitises it. */
  description: string;
  destination?: string;
  primaryCategory: PrimaryCategory | null;
  /** Free-text activity type ("Πεζοπορία"), not the primary category. */
  category?: string;
  duration?: string;
  difficulty?: string;
  participants?: string;
  /** Base price per person (€). */
  priceEur?: number;
  /** Deposit per person (€). */
  depositEur?: number;
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

/* ------------------------------------------------------------------------- */
/* Our Journeys (migration 0014): public archive of completed runs           */
/* ------------------------------------------------------------------------- */

/** Row of public.journeys (+ optional joins). Never holds booking or participant data. */
export type JourneyRow = {
  id: string;
  excursion_id: string;
  departure_id: string | null;
  slug: string;
  status: ContentStatus;
  cover_media_id: string | null;
  title_el: string | null;
  title_en: string | null;
  summary_el: string | null;
  summary_en: string | null;
  description_el: string | null;
  description_en: string | null;
  quote_el: string | null;
  quote_en: string | null;
  location_el: string | null;
  location_en: string | null;
  occurred_on: string;
  occurred_until: string | null;
  photo_consent_confirmed: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  cover?: MediaRow | null;
  images?: Array<{ position: number; media: MediaRow | null }>;
  /** Null for visitors when the excursion itself is not published. */
  excursion?: {
    slug: string;
    primary_category: PrimaryCategory | null;
    destination_el: string | null;
    destination_en: string | null;
  } | null;
};

export type PublicJourney = {
  id: string;
  slug: string;
  /** Languages in which this entry is complete (title + summary). */
  locales: Locale[];
  title: string;
  summary: string;
  /** Editor HTML — render only through <RichText>. */
  description: string;
  quote?: string;
  location?: string;
  /** First day (YYYY-MM-DD) and, for multi-day trips, the last. */
  date: string;
  dateUntil: string | null;
  year: number;
  category: PrimaryCategory | null;
  /** Link to the excursion page while it is published. */
  excursionSlug: string | null;
  cover: CmsImage | null;
  gallery: CmsImage[];
};
