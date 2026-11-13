import type { Locale } from "@/i18n/config";
import type { MediaKey } from "./media";

/** A string available in every supported language. */
export type Localized<T = string> = Record<Locale, T>;

export type PublishStatus = "published" | "draft";

/**
 * An OurWay experience. Only `slug`, `status`, `title`, `summary` and `image`
 * are required — every other field is optional and is simply not rendered
 * when absent. Never fill a field with information OurWay has not confirmed.
 */
export type Activity = {
  slug: string;
  status: PublishStatus;
  title: Localized;
  summary: Localized;
  image: MediaKey;
  gallery?: MediaKey[];
  /** Long description; each entry is a paragraph. */
  description?: Localized<string[]>;
  location?: Localized;
  experienceType?: Localized;
  duration?: Localized;
  difficulty?: Localized;
  groupSize?: Localized;
  included?: Localized<string[]>;
  importantInfo?: Localized<string[]>;
  availability?: Localized;
  /** Slug of a related destination entry. */
  destination?: string;
  /** Show the inquiry CTA for this activity (defaults to true). */
  bookingEnabled?: boolean;
};

export type Destination = {
  slug: string;
  status: PublishStatus;
  name: Localized;
  region?: Localized;
  summary: Localized;
  image: MediaKey;
  description?: Localized<string[]>;
};

/**
 * Drafts render only when SHOW_DRAFT_CONTENT=true (e.g. locally or on a
 * Vercel preview). In production they return 404 and are never listed.
 */
export function isVisible(item: { status: PublishStatus }): boolean {
  return item.status === "published" || process.env.SHOW_DRAFT_CONTENT === "true";
}
