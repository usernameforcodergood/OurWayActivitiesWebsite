import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/**
 * Server-only client with the Supabase secret key (service role). Used only by
 * the public form routes to save requests: since migration 0005 the database
 * accepts submit_*() calls from this key alone, so nobody can skip the
 * website's spam checks by calling the database with the public key.
 * Returns null when the key is not configured (forms then report
 * "not available yet"). Never import this into client components.
 */
export function getSubmissionSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !key) return null;
  client ??= createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
