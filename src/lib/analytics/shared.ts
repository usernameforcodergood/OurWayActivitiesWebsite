/**
 * Analytics definitions shared by the browser tracker and the server.
 * Keep this file free of server-only and heavy imports.
 */

/** Events the browser may send. Booking outcomes are recorded by the server only. */
export const CLIENT_EVENTS = [
  "page_view",
  "session_start",
  "excursion_view",
  "booking_button_click",
  "booking_form_open",
  "booking_form_start",
  "booking_form_submit",
  "search_performed",
  "filter_applied",
] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];

export const CHANNELS = ["direct", "organic", "social", "referral", "paid", "email", "unclassified"] as const;
export type Channel = (typeof CHANNELS)[number];

export const SCREENS = ["small", "medium", "large", "xlarge"] as const;
export type ScreenClass = (typeof SCREENS)[number];

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

/** Headers the booking form adds (only after consent) so the server can attribute the request. */
export const VISITOR_HEADER = "x-ow-visitor";
export const SESSION_HEADER = "x-ow-session";

/** Browser storage keys. */
export const CONSENT_KEY = "ow_consent";
export const VISITOR_KEY = "ow_vid";
export const SESSION_KEY = "ow_sid";
/** Set on browsers that opened the admin panel: they are never tracked. */
export const INTERNAL_KEY = "ow_internal";

/** Version of the consent text; bump it to ask everyone again. */
export const CONSENT_VERSION = 1;

/** A session ends after 30 minutes without activity. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type CollectEvent = {
  id: string;
  name: ClientEventName;
  /** Milliseconds since epoch (browser clock; clamped by the server). */
  t: number;
  path: string;
  title?: string;
  excursionId?: string;
  props?: Record<string, string | number | boolean>;
};

export type CollectPayload = {
  v: 1;
  vid: string;
  sid: string;
  /** First-touch information about the session (sent with every batch, stored once). */
  session: {
    newVisitor: boolean;
    entryPath: string;
    referrer?: string;
    utm?: Partial<Record<UtmKey, string>>;
    /** Google Ads click id present on the landing URL (value not sent). */
    gclid?: boolean;
    screen?: ScreenClass;
    touch?: boolean;
    locale?: "el" | "en";
  };
  events: CollectEvent[];
  engagement?: { id: string; ms: number }[];
};
