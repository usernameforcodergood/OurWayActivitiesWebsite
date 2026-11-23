import "server-only";
import { getSubmissionSupabase } from "@/lib/supabase/server-secret";
import { SESSION_HEADER, VISITOR_HEADER } from "./shared";

/** Analytics can be switched off with NEXT_PUBLIC_ANALYTICS_ENABLED=false. */
export function analyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "false";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/**
 * Internal traffic: any request that carries a Supabase sign-in cookie.
 * Only OurWay administrators have accounts, so a signed-in browser is staff.
 * (The tracker also stops itself on browsers that opened /admin.)
 */
export function isInternalRequest(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)sb-[^=]*-auth-token(?:\.\d+)?=/.test(cookie);
}

/** Country / region / city from the hosting platform's IP lookup. The IP itself is never read or stored. */
export function geoFromHeaders(headers: Headers): { country: string | null; region: string | null; city: string | null } {
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 80) || null;
    } catch {
      return null;
    }
  };
  const country = headers.get("x-vercel-ip-country")?.toUpperCase() ?? null;
  return {
    country: country && /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null,
    region: decode(headers.get("x-vercel-ip-country-region")),
    city: decode(headers.get("x-vercel-ip-city")),
  };
}

/** Visitor/session ids the booking form attached (present only after consent). */
export function analyticsIdsFrom(request: Request): { visitor: string; session: string } | null {
  const visitor = request.headers.get(VISITOR_HEADER);
  const session = request.headers.get(SESSION_HEADER);
  return isUuid(visitor) && isUuid(session) ? { visitor, session } : null;
}

/** Path of the page that sent a request (from Referer; same-origin only). */
export function pagePathFrom(request: Request): string {
  try {
    const ref = new URL(request.headers.get("referer") ?? "");
    if (ref.host !== new URL(request.url).host) return "/";
    return ref.pathname.slice(0, 300) || "/";
  } catch {
    return "/";
  }
}

/**
 * Records the server-confirmed outcome of a booking request. Never throws:
 * analytics must not affect the booking itself. Does nothing for visitors
 * without consent, admins, or when analytics is off.
 */
export async function recordBookingOutcome(
  request: Request,
  outcome: { ok: true; bookingId: string } | { ok: false; excursionId: string | null; reason: string },
): Promise<void> {
  if (!analyticsEnabled() || isInternalRequest(request)) return;
  const ids = analyticsIdsFrom(request);
  if (!ids) return;
  const db = getSubmissionSupabase();
  if (!db) return;
  try {
    const { error } = await db.rpc("analytics_record_booking", {
      p_session: ids.session,
      p_visitor: ids.visitor,
      p_ok: outcome.ok,
      p_booking: outcome.ok ? outcome.bookingId : null,
      p_excursion: outcome.ok ? null : outcome.excursionId,
      p_path: pagePathFrom(request),
      p_reason: outcome.ok ? null : outcome.reason,
    });
    if (error) console.error("[analytics] booking outcome not recorded:", error.code, error.message);
  } catch (e) {
    console.error("[analytics] booking outcome not recorded:", e);
  }
}
