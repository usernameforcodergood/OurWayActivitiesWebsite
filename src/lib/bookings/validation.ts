import { z } from "zod";

/**
 * Shared booking / private-request schemas (client form + route handler).
 * Messages are codes, mapped to localised text in the UI. The database
 * re-validates everything (see supabase/migrations/0003_bookings.sql).
 */
export const BOOKING_STATUSES = ["pending", "confirmed", "rejected", "cancelled", "completed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PRIVATE_STATUSES = ["new", "contacted", "planning", "proposal_sent", "accepted", "rejected", "completed"] as const;
export type PrivateStatus = (typeof PRIVATE_STATUSES)[number];

export const DEPARTURE_STATUSES = ["open", "full", "cancelled", "completed"] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const BOOKING_MODES = ["departures", "interest", "none"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

export const MAX_PARTICIPANTS = 100;
export const MAX_GROUP = 500;
/** Rejects instant bot posts. */
export const MIN_FILL_MS = 2500;

const name = z.string().trim().min(1, "required").max(80, "tooLong");
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

export const bookingRequestSchema = z.object({
  excursionId: z.uuid(),
  departureId: z.uuid("departure").nullable(),
  firstName: name,
  lastName: name,
  email,
  phone,
  participants: intIn(1, MAX_PARTICIPANTS),
  message: optText(3000),
  specialRequests: optText(2000),
  ...antiSpam,
});
export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingRequestData = z.output<typeof bookingRequestSchema>;

const isoDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "date");

export const privateRequestSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    phone,
    participants: intIn(1, MAX_GROUP),
    destination: optText(300),
    destinationFlexible: z.boolean(),
    excursionType: optText(200),
    dateFrom: isoDate,
    dateTo: isoDate,
    datesFlexible: z.boolean(),
    duration: optText(120),
    difficulty: optText(120),
    transport: optText(500),
    activities: optText(2000),
    budgetPerPerson: optText(120),
    message: optText(3000),
    ...antiSpam,
  })
  .superRefine((v, ctx) => {
    if (v.dateFrom && v.dateTo && v.dateTo < v.dateFrom) {
      ctx.addIssue({ code: "custom", path: ["dateTo"], message: "dateOrder" });
    }
  });
export type PrivateRequestInput = z.input<typeof privateRequestSchema>;
export type PrivateRequestData = z.output<typeof privateRequestSchema>;

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
