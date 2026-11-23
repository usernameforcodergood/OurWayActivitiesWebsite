/**
 * OurWay first-party analytics tracker (browser).
 *
 * The single place where tracking happens. Nothing is stored in the browser
 * and nothing is sent before the visitor accepts analytics in the consent
 * banner. Withdrawing consent stops tracking at once, deletes the browser's
 * ids and asks the server to delete what was recorded under them.
 *
 * Events are batched and sent with fetch(keepalive) after a short delay or
 * when the page is hidden, so tracking never blocks the page.
 */
import {
  CONSENT_KEY,
  CONSENT_VERSION,
  INTERNAL_KEY,
  SESSION_KEY,
  SESSION_TIMEOUT_MS,
  SESSION_HEADER,
  UTM_KEYS,
  VISITOR_HEADER,
  VISITOR_KEY,
  type ClientEventName,
  type CollectEvent,
  type CollectPayload,
  type ScreenClass,
  type UtmKey,
} from "./shared";

type Consent = { v: number; analytics: boolean; at: string };
type StoredSession = { id: string; last: number; meta: CollectPayload["session"] };

const ENDPOINT = "/api/collect";
const FLUSH_DELAY_MS = 1500;
export const CONSENT_EVENT = "ow:consent";
export const OPEN_CONSENT_EVENT = "ow:open-consent";

const enabled = () => process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "false";

// --- storage (every access may throw: private mode, blocked storage) --------
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: tracking simply does not persist */
  }
}
function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  // randomUUID needs a secure context; fall back to getRandomValues elsewhere.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// --- consent ----------------------------------------------------------------
/** true / false once the visitor chose; null while undecided. */
export function getConsent(): boolean | null {
  const c = read<Consent>(CONSENT_KEY);
  return c && c.v === CONSENT_VERSION ? c.analytics : null;
}

export function isInternalBrowser(): boolean {
  return read<number>(INTERNAL_KEY) === 1;
}

/** Called by the admin panel: this browser is staff and is never tracked. */
export function markInternalBrowser() {
  write(INTERNAL_KEY, 1);
  stopAndForget(false);
}

function active(): boolean {
  return enabled() && typeof window !== "undefined" && getConsent() === true && !isInternalBrowser();
}

export function setConsent(analytics: boolean) {
  const before = getConsent();
  write(CONSENT_KEY, { v: CONSENT_VERSION, analytics, at: new Date().toISOString() } satisfies Consent);
  if (!analytics) stopAndForget(before === true);
  else if (before !== true) trackPageView(location.pathname);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: analytics }));
}

/** Stops tracking, drops queued data and the browser ids; optionally deletes server data. */
function stopAndForget(deleteServerData: boolean) {
  const vid = read<{ id: string }>(VISITOR_KEY)?.id;
  queue = [];
  engagement.clear();
  current = null;
  remove(VISITOR_KEY);
  remove(SESSION_KEY);
  if (deleteServerData && vid) {
    void fetch(`${ENDPOINT}/forget`, {
      method: "POST",
      body: JSON.stringify({ vid }),
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  }
}

// --- visitor & session ------------------------------------------------------
function visitor(): { id: string; isNew: boolean } {
  const v = read<{ id: string }>(VISITOR_KEY);
  if (v?.id) return { id: v.id, isNew: false };
  const id = uuid();
  write(VISITOR_KEY, { id, created: new Date().toISOString() });
  return { id, isNew: true };
}

/** Viewport width class at the start of the session (no exact sizes are sent). */
function screenClass(): ScreenClass {
  const w = window.innerWidth;
  return w < 640 ? "small" : w < 1024 ? "medium" : w < 1440 ? "large" : "xlarge";
}

function sessionMeta(newVisitor: boolean): CollectPayload["session"] {
  const url = new URL(location.href);
  const utm: Partial<Record<UtmKey, string>> = {};
  for (const k of UTM_KEYS) {
    const v = url.searchParams.get(k)?.trim();
    if (v) utm[k] = v.slice(0, 100);
  }
  const seg = location.pathname.split("/")[1];
  return {
    newVisitor,
    entryPath: location.pathname.slice(0, 300),
    referrer: document.referrer ? document.referrer.slice(0, 2048) : undefined,
    utm: Object.keys(utm).length ? utm : undefined,
    gclid: url.searchParams.has("gclid") || undefined,
    screen: screenClass(),
    touch: navigator.maxTouchPoints > 1,
    locale: seg === "el" || seg === "en" ? seg : undefined,
  };
}

/** Current session, started anew after 30 minutes of inactivity or a new campaign. */
function session(): { s: StoredSession; vid: string; started: boolean } {
  const v = visitor();
  const now = Date.now();
  const stored = read<StoredSession>(SESSION_KEY);
  const campaign = new URL(location.href).searchParams.get("utm_campaign");
  const expired = !stored || now - stored.last > SESSION_TIMEOUT_MS;
  const newCampaign = Boolean(stored && campaign && campaign !== stored.meta.utm?.utm_campaign);
  if (!expired && !newCampaign && stored) {
    stored.last = now;
    write(SESSION_KEY, stored);
    return { s: stored, vid: v.id, started: false };
  }
  const s: StoredSession = { id: uuid(), last: now, meta: sessionMeta(v.isNew) };
  write(SESSION_KEY, s);
  return { s, vid: v.id, started: true };
}

/** Ids for attributing a booking request; null without consent. */
export function analyticsHeaders(): Record<string, string> {
  if (!active()) return {};
  const { s, vid } = session();
  return { [VISITOR_HEADER]: vid, [SESSION_HEADER]: s.id };
}

// --- queue & transport ------------------------------------------------------
let queue: CollectEvent[] = [];
const engagement = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!active() || (queue.length === 0 && engagement.size === 0)) return;
  const stored = read<StoredSession>(SESSION_KEY);
  const vid = read<{ id: string }>(VISITOR_KEY)?.id;
  if (!stored || !vid) return;
  // Page titles can update just after a client-side navigation: read them late.
  for (const e of queue) if (e.name === "page_view" && !e.title && current?.id === e.id) e.title = document.title.slice(0, 200);
  const payload: CollectPayload = {
    v: 1,
    vid,
    sid: stored.id,
    session: stored.meta,
    events: queue.splice(0, 50),
    engagement: [...engagement].slice(0, 50).map(([id, ms]) => ({ id, ms })),
  };
  engagement.clear();
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    /* never let analytics break the page */
  }
  if (queue.length) schedule();
}

function enqueue(name: ClientEventName, data: { excursionId?: string; props?: CollectEvent["props"]; id?: string } = {}) {
  const { started } = session();
  const path = location.pathname.slice(0, 300);
  if (started) queue.push({ id: uuid(), name: "session_start", t: Date.now(), path });
  queue.push({ id: data.id ?? uuid(), name, t: Date.now(), path, excursionId: data.excursionId, props: data.props });
  schedule();
}

// --- page views & engaged time ----------------------------------------------
let current: { id: string; path: string; ms: number; since: number | null; once: Set<string> } | null = null;

function closeEngagement() {
  if (!current) return;
  if (current.since !== null) {
    current.ms += performance.now() - current.since;
    current.since = document.visibilityState === "visible" ? performance.now() : null;
  }
  if (current.ms >= 500) engagement.set(current.id, Math.round(current.ms));
}

/** Records a page view. Called on every route change (and on load). */
export function trackPageView(pathname: string) {
  if (!active() || pathname.startsWith("/admin") || /\/preview(\/|$)/.test(pathname)) return;
  if (current && current.path === pathname) return; // same page (re-render, Strict Mode)
  closeEngagement();
  const id = uuid();
  current = { id, path: pathname, ms: 0, since: document.visibilityState === "visible" ? performance.now() : null, once: new Set() };
  enqueue("page_view", { id });
}

/** Records an interaction on the current page. `onceKey` limits it to once per page view. */
export function track(name: Exclude<ClientEventName, "page_view" | "session_start">, data: { excursionId?: string; props?: CollectEvent["props"]; onceKey?: string } = {}) {
  if (!active() || !current) return;
  if (data.onceKey) {
    if (current.once.has(data.onceKey)) return;
    current.once.add(data.onceKey);
  }
  enqueue(name, data);
}

let installed = false;
/** Installs page-lifecycle listeners once (visibility, unload, delegated clicks). */
export function installTracker() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  document.addEventListener("visibilitychange", () => {
    if (!current) return;
    if (document.visibilityState === "hidden") {
      closeEngagement();
      flush();
    } else if (current.since === null) {
      current.since = performance.now();
    }
  });
  window.addEventListener("pagehide", () => {
    closeEngagement();
    flush();
  });
  // Server-rendered links/buttons declare their event with data attributes.
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("[data-ow-track]");
      if (!el) return;
      const name = el.getAttribute("data-ow-track");
      if (name === "booking_button_click") {
        track("booking_button_click", { excursionId: el.getAttribute("data-ow-excursion") ?? undefined });
      }
    },
    { capture: true },
  );
}
