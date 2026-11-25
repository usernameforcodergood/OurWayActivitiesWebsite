// Live smoke test of a deployed site: public pages, the three request APIs
// (validation, anti-spam, success, idempotent replay, capacity, duplicate
// guard) and the admin login redirect.
//
//   npm run smoke                                   # https://ourway-activities.gr
//   npm run smoke -- https://ourwayactivitieswebsite.netlify.app
//
// It creates real requests in the production database and deletes exactly
// those rows (by reference) at the end. Needs SUPABASE_SECRET_KEY in
// .env.local. With emails enabled on the site, customer copies go to Resend's
// delivered@resend.dev test inbox and admin notifications to CONTACT_EMAIL.
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const BASE = (process.argv[2] || "https://ourway-activities.gr").replace(/\/$/, "");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const results = [];
const refs = new Set();
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const post = async (path, body, raw) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw ?? JSON.stringify(body) });
  const json = await r.json().catch(() => null);
  if (json?.reference) refs.add(json.reference);
  return { status: r.status, body: json };
};
const filledLongAgo = () => Date.now() - 10_000; // passes the minimum fill time
// Resend test inbox: accepted and "delivered" without reaching a real mailbox.
const testPerson = { email: "delivered@resend.dev", phone: "+30 690 000 0000", consent: true, website: "" };

try {
  /* ---------------- pages ---------------- */
  const pages = ["/el", "/en", "/el/activities", "/en/activities", "/el/about", "/el/contact", "/el/destinations", "/el/gallery", "/el/news", "/el/privacy", "/el/tailor-made", "/en/tailor-made", "/admin/login", "/robots.txt", "/sitemap.xml"];
  const bad = [];
  for (const p of pages) {
    const r = await fetch(BASE + p);
    if (r.status !== 200) bad.push(`${p} ${r.status}`);
  }
  check(`${pages.length} public pages answer 200`, bad.length === 0, bad.join(", "));
  check("unknown page → 404", (await fetch(`${BASE}/el/does-not-exist-${Date.now()}`)).status === 404);
  const anon = await fetch(`${BASE}/admin/bookings`, { redirect: "manual" });
  check("admin redirects anonymous visitors to login", anon.status === 307 && (anon.headers.get("location") ?? "").includes("/admin/login"));

  /* ---------------- contact ---------------- */
  const contact = (o = {}) => ({ ...testPerson, name: "TEST Smoke", message: "Automated smoke test — please ignore.", startedAt: filledLongAgo(), locale: "el", idempotencyKey: randomUUID(), ...o });
  check("contact: malformed JSON → 400", (await post("/api/contact", null, "not json")).status === 400);
  let r = await post("/api/contact", contact({ email: "nope", message: "short" }));
  check("contact: invalid fields → 422 with codes", r.status === 422 && r.body?.fields?.email === "email" && r.body?.fields?.message === "messageShort");
  check("contact: honeypot → 400", (await post("/api/contact", contact({ website: "spam" }))).status === 400);
  check("contact: submitted too fast → 400", (await post("/api/contact", contact({ startedAt: Date.now() }))).status === 400);
  const ck = randomUUID();
  r = await post("/api/contact", contact({ idempotencyKey: ck }));
  check("contact: valid → 201", r.status === 201 && !!r.body?.reference, r.body?.reference);
  const replay = await post("/api/contact", contact({ idempotencyKey: ck }));
  check("contact: same submission again → 200, same reference", replay.status === 200 && replay.body?.reference === r.body?.reference);

  /* ---------------- experience requests ---------------- */
  const { data: excursions } = await db.from("excursions").select("id,slug,booking_mode").eq("status", "published");
  const scheduled = excursions?.find((e) => e.booking_mode === "departures");
  const today = new Date().toISOString().slice(0, 10);
  const { data: deps } = scheduled
    ? await db.from("departures").select("id,capacity").eq("excursion_id", scheduled.id).eq("status", "open").gte("departure_date", today).order("departure_date")
    : { data: [] };
  const ex = scheduled ?? excursions?.[0];
  const dep = deps?.[0];
  const booking = (o = {}) => ({ ...testPerson, excursionId: ex?.id, departureId: dep?.id ?? null, fullName: "TEST Smoke", participants: 1, startedAt: filledLongAgo(), locale: "en", idempotencyKey: randomUUID(), ...o });
  r = await post("/api/bookings", booking({ fullName: "Single", phone: "abc", participants: 0 }));
  check("booking: invalid name/phone/participants → 422", r.status === 422 && !!r.body?.fields?.fullName && !!r.body?.fields?.phone && !!r.body?.fields?.participants);
  r = await post("/api/bookings", booking({ excursionId: randomUUID() }));
  check("booking: unknown excursion → 409 unavailable", r.status === 409 && r.body?.error === "unavailable");
  if (!ex) check("booking: a published excursion exists", false);
  if (scheduled) {
    r = await post("/api/bookings", booking({ departureId: null, email: "delivered+interest@resend.dev" }));
    check("booking: scheduled excursion without a departure → saved as interest (201)", r.status === 201);
  }
  if (dep) {
    const bk = randomUUID();
    r = await post("/api/bookings", booking({ idempotencyKey: bk }));
    check("booking: valid participation request → 201", r.status === 201 && !!r.body?.reference, r.body?.reference);
    const again = await post("/api/bookings", booking({ idempotencyKey: bk }));
    check("booking: same submission again → 200, same reference", again.status === 200 && again.body?.reference === r.body?.reference);
    r = await post("/api/bookings", booking());
    check("booking: same person + same departure → 409 duplicate", r.status === 409 && r.body?.error === "duplicate");
    if (dep.capacity) {
      r = await post("/api/bookings", booking({ email: "delivered+capacity@resend.dev", participants: Math.min(100, dep.capacity + 1) }));
      check("booking: more people than places → 409", r.status === 409 && ["capacity", "full"].includes(r.body?.error), `${r.body?.error} remaining=${r.body?.remaining}`);
    }
  } else {
    console.log("SKIP  booking success path: no open future departure");
  }

  /* ---------------- tailor-made ---------------- */
  const future = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
  const tm = (o = {}) => ({ ...testPerson, fullName: "TEST Smoke", destination: "", dateFrom: future, dateTo: "", datesFlexible: true, participants: 6, experienceType: "nature", budgetPerPerson: "", description: "Automated smoke test of the tailor-made form — please ignore.", additionalRequirements: "", startedAt: filledLongAgo(), locale: "el", idempotencyKey: randomUUID(), ...o });
  r = await post("/api/tailor-made-requests", tm({ dateFrom: "2020-01-01", description: "too short", experienceType: "flying" }));
  check("tailor-made: invalid fields → 422 with codes", r.status === 422 && r.body?.fields?.dateFrom === "datePast" && r.body?.fields?.description === "descriptionShort" && r.body?.fields?.experienceType === "experienceType");
  r = await post("/api/tailor-made-requests", tm({ dateTo: "2020-01-01" }));
  check("tailor-made: end before start → 422 dateOrder", r.status === 422 && r.body?.fields?.dateTo === "dateOrder");
  const tk = randomUUID();
  r = await post("/api/tailor-made-requests", tm({ idempotencyKey: tk }));
  check("tailor-made: valid → 201", r.status === 201 && !!r.body?.reference, r.body?.reference);
  const tmAgain = await post("/api/tailor-made-requests", tm({ idempotencyKey: tk }));
  check("tailor-made: same submission again → 200, same reference", tmAgain.status === 200 && tmAgain.body?.reference === r.body?.reference);

  for (const p of ["/api/contact", "/api/bookings", "/api/tailor-made-requests"]) check(`GET ${p} → 405`, (await fetch(BASE + p)).status === 405);
} finally {
  /* ---------------- cleanup: only the rows this run created ---------------- */
  const list = [...refs];
  for (const table of ["bookings", "private_requests", "contact_messages"]) {
    if (!list.length) break;
    const { data } = await db.from(table).select("id").in("reference", list);
    if (!data?.length) continue;
    const { error } = await db.from(table).delete().in("id", data.map((x) => x.id));
    console.log(`cleanup ${table}: ${data.length} test row(s) ${error ? `NOT deleted (${error.message})` : "deleted"}`);
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
if (passed !== results.length) process.exit(1);
