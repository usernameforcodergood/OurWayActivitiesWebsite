import { after, userAgent, type NextRequest } from "next/server";
import { z } from "zod";
import { getSubmissionSupabase } from "@/lib/supabase/server-secret";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { CLIENT_EVENTS, SCREENS, UTM_KEYS } from "@/lib/analytics/shared";
import { classifyChannel, classifyDevice, referrerHost } from "@/lib/analytics/classify";
import { analyticsEnabled, geoFromHeaders, isInternalRequest } from "@/lib/analytics/server";

/**
 * Analytics ingestion for the consent-based first-party tracker.
 *
 * The browser only calls this after the visitor accepted analytics. Every
 * request is checked here before anything is stored:
 *  - same-origin only, size-capped, rate-limited per client;
 *  - known bots and signed-in (admin) browsers are dropped;
 *  - events must be from a fixed list and describe public pages only;
 *  - only paths are kept (no query strings) plus the five UTM tags;
 *  - device/browser/OS and country/region/city are derived here; the IP
 *    address is used only transiently for rate limiting and never stored.
 * The response is always 204 so the endpoint reveals nothing.
 */

const MAX_BYTES = 32 * 1024;
const PUBLIC_PATH = /^\/(el|en)(\/[A-Za-z0-9\-._~%/]*)?$/;
const text = (max: number) => z.string().trim().max(max);
const path = z
  .string()
  .max(300)
  .refine((p) => PUBLIC_PATH.test(p) && !/\/preview(\/|$)/.test(p), "path");

const propValue = z.union([text(80), z.number().finite(), z.boolean()]);

const payloadSchema = z.object({
  v: z.literal(1),
  vid: z.uuid(),
  sid: z.uuid(),
  session: z.object({
    newVisitor: z.boolean(),
    entryPath: path,
    referrer: z.string().max(2048).optional(),
    utm: z.partialRecord(z.enum(UTM_KEYS), text(100)).optional(),
    gclid: z.boolean().optional(),
    screen: z.enum(SCREENS).optional(),
    touch: z.boolean().optional(),
    locale: z.enum(["el", "en"]).optional(),
  }),
  events: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.enum(CLIENT_EVENTS),
        t: z.number().int().positive(),
        path,
        title: text(200).optional(),
        excursionId: z.uuid().optional(),
        props: z.record(z.string().regex(/^[a-z_]{1,24}$/), propValue).optional(),
      }),
    )
    .max(50),
  engagement: z
    .array(z.object({ id: z.uuid(), ms: z.number().int().min(0).max(86_400_000) }))
    .max(50)
    .optional(),
});

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

function sameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return false;
  return Boolean(site || origin);
}

export async function POST(request: NextRequest) {
  if (!analyticsEnabled() || !sameOrigin(request) || isInternalRequest(request)) return done();
  const ua = userAgent(request);
  if (ua.isBot || /headless|lighthouse|pagespeed|crawler|spider|preview/i.test(ua.ua)) return done();
  if (rateLimited(`collect:${clientIp(request)}`, 90, 60_000)) return done();

  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BYTES) return done();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return done();
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return done();
  const p = parsed.data;
  if (p.events.length === 0 && !p.engagement?.length) return done();

  const db = getSubmissionSupabase();
  if (!db) return done();

  const utm = p.session.utm ?? {};
  const refHost = referrerHost(p.session.referrer, request.nextUrl.hostname);
  const { device, browser, os } = classifyDevice(ua, { touch: p.session.touch, screen: p.session.screen });
  const geo = geoFromHeaders(request.headers);
  const now = Date.now();
  // The browser clock is only trusted for ordering within the last 15 minutes.
  const at = (t: number) => new Date(Math.min(now, Math.max(now - 15 * 60_000, t))).toISOString();

  const body = {
    session: {
      id: p.sid,
      visitor_id: p.vid,
      is_new_visitor: p.session.newVisitor,
      entry_path: p.session.entryPath,
      locale: p.session.locale ?? null,
      referrer_host: refHost,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      utm_content: utm.utm_content || null,
      channel: classifyChannel({
        utm: { source: utm.utm_source, medium: utm.utm_medium, campaign: utm.utm_campaign },
        referrerHost: refHost,
        gclid: p.session.gclid,
      }),
      device,
      browser,
      os,
      screen: p.session.screen ?? null,
      ...geo,
    },
    events: p.events.map((e) => ({
      id: e.id,
      name: e.name,
      at: at(e.t),
      path: e.path,
      title: e.title ?? null,
      excursion_id: e.excursionId ?? null,
      props: e.props ?? {},
    })),
    engagement: p.engagement ?? [],
  };

  // Store after responding: the visitor never waits for the database.
  after(async () => {
    const { error } = await db.rpc("analytics_ingest", { p: body });
    if (error) console.error("[analytics] ingest failed:", error.code, error.message);
  });
  return done();
}
