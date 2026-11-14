import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/**
 * Cookie-less anonymous client for the public website. Safe to use inside
 * `"use cache"` functions; RLS limits it to published content.
 * Returns null when Supabase has not been configured yet.
 */
export function getPublicSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  client ??= createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
