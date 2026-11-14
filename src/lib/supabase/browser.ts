"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./config";

let client: SupabaseClient | null = null;

/** Browser client (admin only): used to upload images straight to Storage. */
export function getBrowserSupabase(): SupabaseClient {
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
