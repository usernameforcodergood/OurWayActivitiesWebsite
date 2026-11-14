/**
 * Supabase connection settings. Only the PUBLIC url and publishable (anon)
 * key are used by the app — every admin write runs with the signed-in
 * admin's own session and is enforced again by Row Level Security.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const MEDIA_BUCKET = "media";

/** Public URL of a file in the media bucket. */
export function mediaUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
