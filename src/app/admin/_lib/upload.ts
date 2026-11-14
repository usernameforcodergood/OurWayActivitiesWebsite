"use client";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import { MEDIA_BUCKET } from "@/lib/supabase/config";
import { createMediaRecord } from "../_actions/media";
import type { MediaRow } from "@/lib/cms/types";
import { t, fmt } from "./strings";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_INPUT = 20 * 1024 * 1024;
const MAX_EDGE = 2400;

export const ACCEPT_ATTR = ACCEPTED.join(",");

type Prepared = { blob: Blob; width: number; height: number; mime: "image/webp" | "image/jpeg" };

/** Downscales to max 2400px and re-encodes as WebP (JPEG fallback). */
async function prepare(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  const webp = await encode("image/webp", 0.84);
  if (webp && webp.type === "image/webp") return { blob: webp, width, height, mime: "image/webp" };
  const jpeg = await encode("image/jpeg", 0.86);
  if (!jpeg) throw new Error("encode");
  return { blob: jpeg, width, height, mime: "image/jpeg" };
}

export function validateFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return fmt(t.media.badType, { name: file.name });
  if (file.size > MAX_INPUT) return fmt(t.media.tooLarge, { name: file.name });
  return null;
}

/**
 * Uploads files one by one: optimise in the browser → Storage (admin RLS)
 * → register in the media table. Returns the created records and errors.
 */
export async function uploadImages(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ uploaded: MediaRow[]; errors: string[] }> {
  const supabase = getBrowserSupabase();
  const uploaded: MediaRow[] = [];
  const errors: string[] = [];
  let done = 0;
  onProgress?.(0, files.length);

  for (const file of files) {
    const invalid = validateFile(file);
    if (invalid) {
      errors.push(invalid);
    } else {
      try {
        const img = await prepare(file);
        const now = new Date();
        const ext = img.mime === "image/webp" ? "webp" : "jpg";
        const path = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, img.blob, { contentType: img.mime, cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
        const res = await createMediaRecord({
          path,
          width: img.width,
          height: img.height,
          mime_type: img.mime,
          size_bytes: img.blob.size,
          alt_el: null,
          alt_en: base && !/^(img|dsc|image|photo|pxl)?\s?\d+/i.test(base) ? base.slice(0, 300) : null,
        });
        if (!res.ok) throw new Error(res.error);
        uploaded.push(res.data);
      } catch {
        errors.push(fmt(t.media.uploadFailed, { name: file.name }));
      }
    }
    done += 1;
    onProgress?.(done, files.length);
  }
  return { uploaded, errors };
}
