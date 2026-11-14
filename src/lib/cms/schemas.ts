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
    price_note_el: optText(200),
    price_note_en: optText(200),
    available_dates: z.array(isoDate).max(200),
    availability_note_el: optText(400),
    availability_note_en: optText(400),
    info_el: optText(),
    info_en: optText(),
  })
  .superRefine((v, ctx) => {
    if (!v.title_el && !v.title_en) ctx.addIssue({ code: "custom", path: ["title_el"], message: "titleRequired" });
    if (v.status === "published") {
      const complete = (v.title_el && v.summary_el) || (v.title_en && v.summary_en);
      if (!complete) ctx.addIssue({ code: "custom", path: ["summary_el"], message: "publishNeedsLanguage" });
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
