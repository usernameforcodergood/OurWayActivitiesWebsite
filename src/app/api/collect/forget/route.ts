import type { NextRequest } from "next/server";
import { getSubmissionSupabase } from "@/lib/supabase/server-secret";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { isUuid } from "@/lib/analytics/server";

/**
 * Consent withdrawal: the browser sends its random visitor id once, then
 * forgets it. Everything recorded under that id is deleted. The id is a
 * random UUID that only that browser knew, so nobody else can delete data.
 */
export async function POST(request: NextRequest) {
  const res = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return res;
  if (rateLimited(`forget:${clientIp(request)}`, 10, 60_000)) return res;
  let vid: unknown;
  try {
    vid = ((await request.json()) as { vid?: unknown }).vid;
  } catch {
    return res;
  }
  if (!isUuid(vid)) return res;
  const db = getSubmissionSupabase();
  if (!db) return res;
  const { error } = await db.rpc("analytics_forget", { p_visitor: vid });
  if (error) console.error("[analytics] forget failed:", error.code, error.message);
  return res;
}
