import { NextResponse } from "next/server";
import { getPublicSupabase } from "@/lib/supabase/public";
import type { PublicDeparture } from "@/lib/cms/types";
import { toPublicDeparture, type DepartureAvailabilityRow } from "@/lib/cms/mappers";

/**
 * Live availability of one published excursion's departures. Never cached:
 * remaining places change with every request and admin decision. Returns
 * counts only, no personal data (see public_departures() in the database).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/availability/[excursionId]">) {
  const { excursionId } = await ctx.params;
  const headers = { "Cache-Control": "no-store" };
  if (!/^[0-9a-f-]{36}$/i.test(excursionId)) return NextResponse.json({ departures: [] }, { status: 404, headers });
  const db = getPublicSupabase();
  if (!db) return NextResponse.json({ departures: [] }, { status: 503, headers });
  const { data, error } = await db.rpc("public_departures", { p_excursion_id: excursionId });
  if (error) {
    console.error("[availability]", error.message);
    return NextResponse.json({ departures: [] }, { status: 500, headers });
  }
  const departures: PublicDeparture[] = ((data ?? []) as DepartureAvailabilityRow[]).map(toPublicDeparture);
  return NextResponse.json({ departures }, { headers });
}
