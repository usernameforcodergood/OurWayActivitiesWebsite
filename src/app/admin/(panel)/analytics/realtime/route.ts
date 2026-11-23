import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { getRealtime } from "../../../_lib/analytics-queries";

/** Real-time analytics for the dashboard panel (admins only; polled every 30 s). */
export async function GET() {
  const admin = await getAdmin();
  if (admin.status !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    return NextResponse.json(await getRealtime(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
