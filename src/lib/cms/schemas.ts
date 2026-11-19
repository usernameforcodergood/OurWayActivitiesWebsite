import { z } from "zod";

/** Shared by admin forms and Server Actions. Messages are error codes. */

const optText = (max = 20000) =>
  z
    .string()
    .max(max, "tooLong")
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const slugSchema = z
  .string()
  .trim()
  .min(1, "slugInvalid")
  .max(120, "slugInvalid")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slugInvalid");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid");
const timeOpt = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || /^\d{2}:\d{2}(:\d{2})?$/.test(v), "timeInvalid");
const intOpt = (min: number, max: number, code: string) =>
  z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: code });
        return z.NEVER;
      }
      return n;
    });
const priceOpt = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "priceInvalid" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

export const departureSchema = z
  .object({
    id: z.uuid().optional(),
    excursion_id: z.uuid(),
    departure_date: isoDate,
    departure_time: timeOpt,
    return_time: timeOpt,
    price_eur: priceOpt,
    capacity: intOpt(1, 10000, "capacityInvalid"),
    min_participants: intOpt(1, 10000, "minInvalid"),
    /** Greek local date-time "YYYY-MM-DDTHH:mm", converted on the server. */
    booking_deadline: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "dateInvalid"),
    status: z.enum(["open", "full", "cancelled", "completed"]),
    note_el: optText(400),
    note_en: optText(400),
  })
  .superRefine((v, ctx) => {
    if (v.capacity && v.min_participants && v.min_participants > v.capacity) {
      ctx.addIssue({ code: "custom", path: ["min_participants"], message: "minAboveCapacity" });
    }
  });
export type DepartureInput = z.input<typeof departureSchema>;

export const excursionSchema = z
  .object({
    id: z.uuid().optional(),
    slug: slugSchema,
    status: z.enum(["draft", "published"]),
    featured: z.boolean(),
    cover_media_id: z.uuid().nullable(),
    gallery: z.array(z.uuid()).max(40),
    title_el: optText(200),
    title_en: optText(200),
    summary_el: optText(600),
    summary_en: optText(600),
    description_el: optText(),
    description_en: optText(),
    destination_el: optText(200),
    destination_en: optText(200),
    category_el: optText(120),
    category_en: optText(120),
    duration_el: optText(120),
    duration_en: optText(120),
    difficulty_el: optText(120),
    difficulty_en: optText(120),
    participants: optText(120),
    price_eur: z
      .union([z.number(), z.string()])
      .nullable()
      .transform((v, ctx) => {
        if (v === null || v === "") return null;
        const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
          ctx.addIssue({ code: "custom", message: "priceInvalid" });
          return z.NEVER;
        }
        return Math.round(n * 100) / 100;
      }),
    /** Deposit per person (€). Optional; never negative or above the price. */
    deposit_eur: z
      .union([z.number(), z.string()])
      .nullable()
      .optional()
      .transform((v, ctx) => {
        if (v === null || v === undefined || String(v).trim() === "") return null;
        const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
          ctx.addIssue({ code: "custom", message: "depositInvalid" });
          return z.NEVER;
        }
        return Math.round(n * 100) / 100;
      }),
    // Legacy free-text note: no longer edited in the admin, but passed through
    // unchanged so saving never erases what is already stored.
    price_note_el: optText(200),
    price_note_en: optText(200),
    kind: z.enum(["excursion", "event"]),
    booking_mode: z.enum(["departures", "interest", "none"]),
    primary_category: z.enum(["day_trip", "two_day", "package"]).nullable(),
    meeting_point_el: optText(300),
    meeting_point_en: optText(300),
    included_el: optText(4000),
    included_en: optText(4000),
    cancellation_policy_el: optText(4000),
    cancellation_policy_en: optText(4000),
    availability_note_el: optText(400),
    availability_note_en: optText(400),
    info_el: optText(),
    info_en: optText(),
  })
  .superRefine((v, ctx) => {
    if (!v.title_el && !v.title_en) ctx.addIssue({ code: "custom", path: ["title_el"], message: "titleRequired" });
    if (v.deposit_eur != null && v.price_eur != null && v.deposit_eur > v.price_eur) {
      ctx.addIssue({ code: "custom", path: ["deposit_eur"], message: "depositAbovePrice" });
    }
    if (v.status === "published") {
      const complete = (v.title_el && v.summary_el) || (v.title_en && v.summary_en);
      if (!complete) ctx.addIssue({ code: "custom", path: ["summary_el"], message: "publishNeedsLanguage" });
      // Every published excursion appears under one of the three categories.
      if (v.kind === "excursion" && !v.primary_category) {
        ctx.addIssue({ code: "custom", path: ["primary_category"], message: "categoryRequired" });
      }
    }
  });

export type ExcursionInput = z.input<typeof excursionSchema>;
export type ExcursionData = z.output<typeof excursionSchema>;

export const announcementSchema = z
  .object({
    id: z.uuid().optional(),
    slug: slugSchema,
    status: z.enum(["draft", "published"]),
    featured: z.boolean(),
    image_media_id: z.uuid().nullable(),
    title_el: optText(200),
    title_en: optText(200),
    summary_el: optText(600),
    summary_en: optText(600),
    body_el: optText(),
    body_en: optText(),
    publish_at: z.iso.datetime({ offset: true, message: "dateInvalid" }),
    expires_at: z.iso.datetime({ offset: true, message: "dateInvalid" }).nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.title_el && !v.title_en) ctx.addIssue({ code: "custom", path: ["title_el"], message: "titleRequired" });
    if (v.status === "published") {
      const complete = (v.title_el && v.summary_el) || (v.title_en && v.summary_en);
      if (!complete) ctx.addIssue({ code: "custom", path: ["summary_el"], message: "publishNeedsLanguage" });
    }
    if (v.expires_at && new Date(v.expires_at) <= new Date(v.publish_at)) {
      ctx.addIssue({ code: "custom", path: ["expires_at"], message: "expiryBeforePublish" });
    }
  });

export type AnnouncementInput = z.input<typeof announcementSchema>;
export type AnnouncementData = z.output<typeof announcementSchema>;

const optUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), "urlInvalid");

export const settingsSchema = z.object({
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.email().safeParse(v).success, "emailInvalid"),
  phone: optText(60),
  address_el: optText(300),
  address_en: optText(300),
  instagram_url: optUrl,
  facebook_url: optUrl,
  linkedin_url: optUrl,
});

export type SettingsInput = z.input<typeof settingsSchema>;

export const mediaRecordSchema = z.object({
  path: z.string().regex(/^uploads\/\d{4}\/\d{2}\/[a-z0-9-]+\.(webp|jpg|jpeg|png|avif)$/),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  mime_type: z.enum(["image/webp", "image/jpeg", "image/png", "image/avif"]),
  size_bytes: z.number().int().nonnegative().max(20 * 1024 * 1024),
  alt_el: optText(300),
  alt_en: optText(300),
});

export type MediaRecordInput = z.input<typeof mediaRecordSchema>;

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Flattens Zod issues into { field: code }. */
export function issuesToFields(issues: Array<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "_");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
