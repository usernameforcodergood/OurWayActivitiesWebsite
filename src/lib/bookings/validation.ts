import { z } from "zod";

/**
 * Shared booking / private-request schemas (client form + route handler).
 * Messages are codes, mapped to localised text in the UI. The database
 * re-validates everything (see supabase/migrations/0003_bookings.sql).
 */
/** Scheduled-excursion participation requests (bookings.kind = 'booking'). */
export const BOOKING_STATUSES = ["pending", "confirmed", "rejected", "cancelled", "completed"] as const;
/** General-experience inquiries (bookings.kind = 'interest'), migration 0007. */
export const INQUIRY_STATUSES = ["new", "contacted", "in_progress", "closed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number] | InquiryStatus;

/**
 * One admin view across both kinds: every status belongs to one of four stages
 * (new / being handled / confirmed / cancelled or closed).
 */
export const REQUEST_STAGES = {
  new: ["pending", "new"],
  processing: ["contacted", "in_progress"],
  confirmed: ["confirmed", "completed"],
  cancelled: ["rejected", "cancelled", "closed"],
} as const satisfies Record<string, readonly BookingStatus[]>;
export type RequestStage = keyof typeof REQUEST_STAGES;

/** Tailor-made request statuses (table public.private_requests). */
export const PRIVATE_STATUSES = ["new", "in_review", "contacted", "quotation_sent", "confirmed", "completed", "rejected"] as const;
export type PrivateStatus = (typeof PRIVATE_STATUSES)[number];

export const EXPERIENCE_TYPES = ["hiking", "adventure", "nature", "culture", "gastronomy", "multi_day", "other"] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export const DEPARTURE_STATUSES = ["open", "full", "cancelled", "completed"] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const BOOKING_MODES = ["departures", "interest", "none"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

/** Anchor of the request form on experience pages ("Δηλώστε ενδιαφέρον ↓"). */
export const REQUEST_FORM_ID = "interest-form";

export const MAX_PARTICIPANTS = 100;
export const MAX_GROUP = 500;
/** Rejects instant bot posts. */
export const MIN_FILL_MS = 2500;

const email = z.string().trim().min(1, "required").max(200, "tooLong").pipe(z.email("email"));
const phone = z
  .string()
  .trim()
  .min(1, "required")
  .max(40, "tooLong")
  .regex(/^[+()\d\s.-]{6,40}$/, "phone");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));
const intIn = (min: number, max: number) =>
  z.union([z.number(), z.string()]).transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: "participants" });
      return z.NEVER;
    }
    return n;
  });

const antiSpam = {
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional(),
  startedAt: z.number().int().positive(),
  locale: z.enum(["el", "en"]),
  /** One per form instance: a retried or double-clicked submit maps to the same request. */
  idempotencyKey: z.uuid(),
  consent: z.boolean().refine((v) => v === true, "consent"),
};

const isoDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "date");

/** "Name Surname" → first / last (the surname is the last word). */
export function splitFullName(full: string): { first: string; last: string } | null {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** Today's date in Athens as YYYY-MM-DD (dates are Greek calendar days). */
export function athensToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const fullName = z
  .string()
  .trim()
  .min(1, "required")
  .max(160, "tooLong")
  .refine((v) => {
    const n = splitFullName(v);
    return Boolean(n && n.first.length <= 80 && n.last.length <= 80);
  }, "fullName");

/**
 * Both experience-page forms (stored in public.bookings):
 * - Scheduled excursion: departureId required, participation request.
 * - General experience: no departure; optional preferred date / period.
 * The database decides which one applies from the experience's booking_mode.
 */
export const bookingRequestSchema = z.object({
  excursionId: z.uuid(),
  departureId: z.uuid("departure").nullable(),
  fullName,
  email,
  phone,
  participants: intIn(1, MAX_PARTICIPANTS),
  preferredPeriod: optText(200),
  message: optText(3000),
  ...antiSpam,
});
export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingRequestData = z.output<typeof bookingRequestSchema>;

/** Tailor-made experience request (stored in public.private_requests). */
export const tailorMadeRequestSchema = z
  .object({
    fullName,
    email,
    phone,
    destination: optText(300),
    dateFrom: z
      .string()
      .trim()
      .min(1, "required")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date")
      // One day of slack so a visitor in another time zone is never rejected unfairly.
      .refine((v) => v >= athensToday(new Date(Date.now() - 86_400_000)), "datePast"),
    dateTo: isoDate,
    datesFlexible: z.boolean(),
    participants: intIn(1, MAX_GROUP),
    experienceType: z.enum(EXPERIENCE_TYPES, "experienceType"),
    budgetPerPerson: optText(120),
    description: z.string().trim().min(1, "required").min(20, "descriptionShort").max(3000, "tooLong"),
    additionalRequirements: optText(2000),
    ...antiSpam,
  })
  .superRefine((v, ctx) => {
    if (v.dateTo && v.dateTo < v.dateFrom) ctx.addIssue({ code: "custom", path: ["dateTo"], message: "dateOrder" });
  });
export type TailorMadeRequestInput = z.input<typeof tailorMadeRequestSchema>;
export type TailorMadeRequestData = z.output<typeof tailorMadeRequestSchema>;

export type SubmitError =
  | "invalid"
  | "rateLimited"
  | "generic"
  | "notConfigured"
  | "capacity"
  | "full"
  | "departureClosed"
  | "deadlinePassed"
  | "unavailable"
  | "departureRequired"
  | "duplicate";

export type SubmitResponse =
  | { ok: true; reference: string; emailSent: boolean }
  | { ok: false; error: SubmitError; remaining?: number; fields?: Record<string, string> };

/** Maps the database's error messages to API error codes. */
export function mapDbError(message: string | undefined): { error: SubmitError; remaining?: number } {
  const m = message ?? "";
  const cap = /^capacity:(\d+)$/.exec(m);
  if (cap) return { error: "capacity", remaining: Number(cap[1]) };
  const map: Record<string, SubmitError> = {
    full: "full",
    departure_closed: "departureClosed",
    deadline_passed: "deadlinePassed",
    unavailable: "unavailable",
    departure_required: "departureRequired",
    duplicate: "duplicate",
    consent: "invalid",
    invalid: "invalid",
  };
  return { error: map[m] ?? "generic" };
}
