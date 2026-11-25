// Sends one copy of every transactional email (rendered with the site's real
// templates) to a single inbox, so the whole set can be checked in one go.
//
//   npm run email:test                 # sends from Resend's shared test sender
//   npm run email:test -- --domain     # sends from CONTACT_FROM_EMAIL (needs a verified domain)
//   npm run email:test -- --dry        # renders only, sends nothing
//   npm run email:test -- --to you@example.com
//
// Without a verified domain Resend only delivers to the Resend account owner.
// Reads RESEND_API_KEY / CONTACT_EMAIL / CONTACT_FROM_EMAIL from .env.local.
// Nothing touches the database. Subjects are prefixed with [TEST n/N].
import { createJiti } from "jiti";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(ROOT, ".env.local"), quiet: true });
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://ourway-activities.gr").replace(/\/$/, "");
process.env.NEXT_PUBLIC_SITE_URL = SITE;

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dry = args.includes("--dry");
const FROM = args.includes("--domain") ? process.env.CONTACT_FROM_EMAIL : "OurWay (TEST) <onboarding@resend.dev>";
const TO = arg("--to") || process.env.CONTACT_EMAIL;
const KEY = process.env.RESEND_API_KEY;
if (!dry && (!KEY || !TO || !FROM)) {
  console.error("Missing RESEND_API_KEY, a recipient (CONTACT_EMAIL or --to) or CONTACT_FROM_EMAIL (with --domain).");
  process.exit(1);
}

// "server-only" throws outside Next's server bundle; it is a no-op here.
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(ROOT, "src"), "server-only": path.join(ROOT, "scripts", "lib", "empty.cjs") },
});
const E = await jiti.import(path.join(ROOT, "src/lib/bookings/emails.ts"));

const booking = (locale, extra = {}) => ({
  reference: "OW-TEST01",
  locale,
  firstName: locale === "el" ? "Μαρία" : "Maria",
  lastName: locale === "el" ? "Δοκιμή" : "Test",
  email: "customer@example.com",
  phone: "+30 690 000 0000",
  participants: 3,
  excursionTitle: locale === "el" ? "Χορτιάτης — νυχτερινή πεζοπορία" : "Chortiatis — night hike",
  excursionUrl: `${SITE}/${locale}/activities/chortiatis-nychterini-pezoporia`,
  departureDate: "2027-04-17",
  departureTime: "19:30:00",
  unitPriceEur: 25,
  totalEur: 75,
  message: locale === "el" ? "Δοκιμαστικό μήνυμα." : "Test message.",
  specialRequests: null,
  kind: "booking",
  ...extra,
});
const interest = (locale) =>
  booking(locale, { kind: "interest", departureDate: null, departureTime: null, unitPriceEur: null, totalEur: null, preferredPeriod: locale === "el" ? "Μάιος 2027" : "May 2027" });
const tailorMade = (locale) => ({
  reference: "TM-TEST01",
  locale,
  firstName: locale === "el" ? "Νίκος" : "Nick",
  lastName: locale === "el" ? "Δοκιμή" : "Test",
  email: "customer@example.com",
  phone: "+30 690 000 0000",
  participants: 8,
  details:
    locale === "el"
      ? [["Τύπος ομάδας", "Εταιρική ομάδα"], ["Διάστημα", "Ιούνιος 2027"], ["Ιδέα", "Καγιάκ και πικνίκ στη Χαλκιδική."]]
      : [["Group type", "Company team"], ["Period", "June 2027"], ["Idea", "Kayaking and a picnic in Halkidiki."]],
});

// Mirrors buildEmail() in src/app/api/contact/route.ts (not exported there).
function contactEmail() {
  const rows = [["Reference", "MSG-TEST01"], ["Name", "Maria Test"], ["Email", "customer@example.com"], ["Phone", "+30 690 000 0000"], ["Interest", "Hiking"], ["Participants", "3"], ["Site language", "Greek"]];
  const msg = "Test contact message from the website.";
  return {
    subject: "OurWay inquiry — Maria Test",
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nMessage:\n${msg}`,
    html: `<table cellpadding="6" style="font-family:sans-serif;font-size:14px">${rows.map(([k, v]) => `<tr><td style="color:#666">${k}</td><td><strong>${v}</strong></td></tr>`).join("")}</table><p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap">${msg}</p>`,
  };
}

const emails = [];
for (const locale of ["el", "en"]) {
  emails.push([`customer booking received (${locale})`, E.renderCustomerBookingEmail("received", booking(locale))]);
  emails.push([`customer interest received (${locale})`, E.renderCustomerBookingEmail("received", interest(locale))]);
  emails.push([`customer booking confirmed (${locale})`, E.renderCustomerBookingEmail("confirmed", booking(locale, { adminNote: locale === "el" ? "Ραντεβού στην πλατεία στις 19:15." : "Meet at the square at 19:15." }))]);
  emails.push([`customer booking rejected (${locale})`, E.renderCustomerBookingEmail("rejected", booking(locale))]);
  emails.push([`customer booking cancelled (${locale})`, E.renderCustomerBookingEmail("cancelled", booking(locale))]);
  emails.push([`customer tailor-made received (${locale})`, E.renderPrivateReceived(tailorMade(locale))]);
}
emails.push(["admin new booking", E.renderAdminNewBooking(booking("el"), `${SITE}/admin/bookings/test`)]);
emails.push(["admin new interest", E.renderAdminNewBooking(interest("en"), `${SITE}/admin/bookings/test`)]);
emails.push(["admin new tailor-made", E.renderAdminNewPrivate(tailorMade("el"), `${SITE}/admin/tailor-made/test`)]);
emails.push(["admin contact message", contactEmail()]);

console.log(dry ? "Dry run: nothing is sent." : `From: ${FROM}`);
let failed = 0;
for (const [i, [label, email]] of emails.entries()) {
  const subject = `[TEST ${i + 1}/${emails.length}] ${email.subject}`;
  if (dry) {
    console.log(`${i + 1}. ${label} | ${subject}`);
    continue;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: TO, reply_to: "customer@example.com", subject, text: email.text, html: email.html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) failed++;
  console.log(`${i + 1}. ${label} -> ${res.status} ${body.id ?? body.message ?? ""}`);
  await new Promise((r) => setTimeout(r, 700)); // stay under Resend's rate limit
}
if (failed) process.exit(1);
