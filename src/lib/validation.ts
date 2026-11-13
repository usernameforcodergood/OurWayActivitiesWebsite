import { z } from "zod";

/**
 * Shared contact-form schema, used by the client (React Hook Form) and the
 * server (route handler). Error messages are *codes*, mapped to localised
 * text in the UI, so the schema itself stays language-neutral.
 */
export const errorCodes = [
  "required",
  "nameShort",
  "email",
  "phone",
  "messageShort",
  "tooLong",
  "participants",
  "date",
  "consent",
] as const;
export type FieldErrorCode = (typeof errorCodes)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

function isTodayOrLater(value: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d >= today;
}

export const contactSchema = z.object({
  name: z.string().trim().min(1, "required").min(2, "nameShort").max(120, "tooLong"),
  email: z.string().trim().min(1, "required").max(200, "tooLong").pipe(z.email("email")),
  phone: optionalText(40).refine((v) => !v || /^[+()\d\s.-]{6,}$/.test(v), "phone"),
  interest: optionalText(200),
  date: optionalText(20).refine((v) => !v || isTodayOrLater(v), "date"),
  participants: optionalText(4).refine((v) => {
    if (!v) return true;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 100;
  }, "participants"),
  message: z.string().trim().min(1, "required").min(10, "messageShort").max(5000, "tooLong"),
  consent: z.boolean().refine((v) => v === true, "consent"),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional(),
  /** Time the form was rendered (ms since epoch) — rejects instant bot posts. */
  startedAt: z.number().int().positive(),
  locale: z.enum(["el", "en"]),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;

/** API response contract. */
export type ContactResponse =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "notConfigured" | "rateLimited" | "generic";
      fields?: Partial<Record<keyof ContactInput, FieldErrorCode>>;
    };
