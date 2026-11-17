import "server-only";
import type { Locale } from "@/i18n/config";
import { siteConfig } from "@/lib/site";
import { formatDateLong, formatEur } from "./format";

/**
 * Branded transactional emails. Every email to a customer states the
 * request's status plainly: "pending" emails never say the place is booked,
 * and only an administrator's explicit confirmation produces the
 * "confirmed" email. There is never any payment link or instruction.
 */

export type BookingEmailData = {
  reference: string;
  locale: Locale;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  participants: number;
  excursionTitle: string;
  excursionUrl?: string;
  /** YYYY-MM-DD; absent for expressions of interest. */
  departureDate?: string | null;
  departureTime?: string | null;
  unitPriceEur?: number | null;
  totalEur?: number | null;
  message?: string | null;
  specialRequests?: string | null;
  /** Optional note from the administrator to the customer. */
  adminNote?: string | null;
  kind: "booking" | "interest";
};

export type PrivateEmailData = {
  reference: string;
  locale: Locale;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  participants: number;
  details: Array<[string, string]>;
};

export type Rendered = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export { formatDateLong, formatEur };

type Tone = "pending" | "confirmed" | "declined" | "admin";

function layout(opts: {
  locale: Locale;
  preheader: string;
  badge: string;
  tone: Tone;
  heading: string;
  intro: string[];
  rows: Array<[string, string]>;
  outro: string[];
}): string {
  const badgeColors: Record<Tone, [string, string]> = {
    pending: ["#f6ecd6", "#6b4a12"],
    confirmed: ["#d9efe6", "#14513f"],
    declined: ["#efe2dc", "#7a2e17"],
    admin: ["#e3eef0", "#1b5560"],
  };
  const [bg, fg] = badgeColors[opts.tone];
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b302d">${esc(t)}</p>`;
  return `<!doctype html><html lang="${opts.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f2efe7">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe7"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif">
<tr><td style="background:#12211d;padding:22px 28px;color:#f2efe7;font-size:20px;font-weight:700;letter-spacing:-0.01em">Our<span style="color:#8ccbb8">Way</span></td></tr>
<tr><td style="padding:28px">
<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${esc(opts.badge)}</span>
<h1 style="margin:16px 0 18px;font-size:22px;line-height:1.3;color:#0c1311">${esc(opts.heading)}</h1>
${opts.intro.map(p).join("")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;border-top:1px solid #e6e2d8">
${opts.rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #e6e2d8;color:#6a6d63;font-size:14px;vertical-align:top;width:42%">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #e6e2d8;color:#0c1311;font-size:14px;font-weight:600;white-space:pre-wrap">${esc(v)}</td></tr>`,
  )
  .join("")}
</table>
${opts.outro.map(p).join("")}
</td></tr>
<tr><td style="padding:18px 28px;background:#f5f2ea;color:#6a6d63;font-size:12px;line-height:1.5">OurWay · ${esc(siteConfig.url.replace(/^https?:\/\//, ""))}</td></tr>
</table></td></tr></table></body></html>`;
}

function plain(heading: string, intro: string[], rows: Array<[string, string]>, outro: string[]): string {
  return [heading, "", ...intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...outro, "", "OurWay"].join("\n");
}

/* ------------------------------------------------------------------------ */
/* Customer booking emails                                                   */
/* ------------------------------------------------------------------------ */

const C = {
  el: {
    reference: "Κωδικός αιτήματος",
    experience: "Εμπειρία",
    date: "Ημερομηνία",
    participants: "Συμμετέχοντες",
    unitPrice: "Τιμή ανά άτομο",
    total: "Ενδεικτικό σύνολο",
    name: "Όνομα",
    phone: "Τηλέφωνο",
    note: "Σημείωση από την OurWay",
    noPayment:
      "Δεν απαιτείται καμία πληρωμή μέσω της ιστοσελίδας. Η τιμή είναι ενδεικτική· οποιαδήποτε οικονομική διευθέτηση γίνεται απευθείας με την ομάδα μας.",
    replyHint: "Για οποιαδήποτε ερώτηση, απαντήστε σε αυτό το email αναφέροντας τον κωδικό σας.",
    received: {
      subjectBooking: "Λάβαμε το αίτημα κράτησής σας — {ref} (σε αναμονή επιβεβαίωσης)",
      subjectInterest: "Λάβαμε την εκδήλωση ενδιαφέροντός σας — {ref}",
      badge: "Σε αναμονή",
      heading: "Λάβαμε το αίτημά σας",
      intro: [
        "Γεια σας {name},",
        "Η εκδήλωση ενδιαφέροντος καταχωρήθηκε επιτυχώς. Η κράτησή σας δεν έχει ακόμη επιβεβαιωθεί. Θα επικοινωνήσουμε μαζί σας σύντομα για την οριστικοποίησή της.",
      ],
    },
    confirmed: {
      subject: "Η κράτησή σας επιβεβαιώθηκε — {ref}",
      badge: "Επιβεβαιωμένη",
      heading: "Η κράτησή σας επιβεβαιώθηκε",
      intro: ["Γεια σας {name},", "Με χαρά σας ενημερώνουμε ότι η ομάδα της OurWay επιβεβαίωσε την κράτησή σας."],
    },
    rejected: {
      subject: "Σχετικά με το αίτημά σας — {ref}",
      badge: "Δεν επιβεβαιώθηκε",
      heading: "Δεν μπορέσαμε να επιβεβαιώσουμε το αίτημά σας",
      intro: [
        "Γεια σας {name},",
        "Λυπούμαστε, αλλά δεν μπορούμε να επιβεβαιώσουμε αυτό το αίτημα. Δεν έχει γίνει καμία κράτηση και δεν υπάρχει καμία χρέωση.",
      ],
    },
    cancelled: {
      subject: "Ακύρωση κράτησης — {ref}",
      badge: "Ακυρώθηκε",
      heading: "Η κράτησή σας ακυρώθηκε",
      intro: ["Γεια σας {name},", "Σας ενημερώνουμε ότι η παρακάτω κράτηση ακυρώθηκε."],
    },
  },
  en: {
    reference: "Request reference",
    experience: "Experience",
    date: "Date",
    participants: "Participants",
    unitPrice: "Price per person",
    total: "Indicative total",
    name: "Name",
    phone: "Phone",
    note: "Note from OurWay",
    noPayment:
      "No payment is taken through the website. Prices are indicative; any financial arrangement is made directly with our team.",
    replyHint: "If you have any questions, reply to this email and mention your reference.",
    received: {
      subjectBooking: "We received your booking request — {ref} (awaiting confirmation)",
      subjectInterest: "We received your expression of interest — {ref}",
      badge: "Pending",
      heading: "We received your request",
      intro: [
        "Hello {name},",
        "Your request has been registered successfully. Your booking is not confirmed yet. We will contact you soon to finalise it.",
      ],
    },
    confirmed: {
      subject: "Your booking is confirmed — {ref}",
      badge: "Confirmed",
      heading: "Your booking is confirmed",
      intro: ["Hello {name},", "We are happy to let you know that the OurWay team has confirmed your booking."],
    },
    rejected: {
      subject: "About your request — {ref}",
      badge: "Not confirmed",
      heading: "We could not confirm your request",
      intro: [
        "Hello {name},",
        "We are sorry, but we cannot confirm this request. No booking has been made and nothing has been charged.",
      ],
    },
    cancelled: {
      subject: "Booking cancelled — {ref}",
      badge: "Cancelled",
      heading: "Your booking has been cancelled",
      intro: ["Hello {name},", "This is to let you know that the booking below has been cancelled."],
    },
  },
} as const;

const fill = (s: string, d: { reference: string; firstName: string }) =>
  s.replace("{ref}", d.reference).replace("{name}", d.firstName);

function bookingRows(d: BookingEmailData, withPrice: boolean): Array<[string, string]> {
  const c = C[d.locale];
  const rows: Array<[string, string]> = [
    [c.reference, d.reference],
    [c.experience, d.excursionTitle],
  ];
  if (d.departureDate) rows.push([c.date, formatDateLong(d.departureDate, d.locale, d.departureTime)]);
  rows.push([c.participants, String(d.participants)]);
  if (withPrice && d.unitPriceEur != null) rows.push([c.unitPrice, formatEur(d.unitPriceEur, d.locale)]);
  if (withPrice && d.totalEur != null) rows.push([c.total, formatEur(d.totalEur, d.locale)]);
  if (d.adminNote) rows.push([c.note, d.adminNote]);
  return rows;
}

export type CustomerBookingEmail = "received" | "confirmed" | "rejected" | "cancelled";

export function renderCustomerBookingEmail(kind: CustomerBookingEmail, d: BookingEmailData): Rendered {
  const c = C[d.locale];
  const k = c[kind];
  const subject = fill(
    kind === "received" ? (d.kind === "interest" ? c.received.subjectInterest : c.received.subjectBooking) : (k as { subject: string }).subject,
    d,
  );
  const tone: Tone = kind === "received" ? "pending" : kind === "confirmed" ? "confirmed" : "declined";
  const intro = k.intro.map((s) => fill(s, d));
  const rows = bookingRows(d, kind === "received" || kind === "confirmed");
  const outro = [...(kind === "rejected" || kind === "cancelled" ? [] : [c.noPayment]), c.replyHint];
  return {
    subject,
    text: plain(k.heading, intro, rows, outro),
    html: layout({ locale: d.locale, preheader: intro[1] ?? subject, badge: k.badge, tone, heading: k.heading, intro, rows, outro }),
  };
}

/* ------------------------------------------------------------------------ */
/* Admin notifications (Greek, the admin interface language)                 */
/* ------------------------------------------------------------------------ */

export function renderAdminNewBooking(d: BookingEmailData, adminUrl: string): Rendered {
  const isInterest = d.kind === "interest";
  const heading = isInterest ? "Νέα εκδήλωση ενδιαφέροντος" : "Νέο αίτημα κράτησης";
  const rows: Array<[string, string]> = [
    ["Κωδικός", d.reference],
    ["Εμπειρία", d.excursionTitle],
    ...(d.departureDate ? [["Ημερομηνία", formatDateLong(d.departureDate, "el", d.departureTime)] as [string, string]] : []),
    ["Συμμετέχοντες", String(d.participants)],
    ...(d.totalEur != null ? [["Ενδεικτικό σύνολο", formatEur(d.totalEur, "el")] as [string, string]] : []),
    ["Όνομα", `${d.firstName} ${d.lastName}`],
    ["Email", d.email],
    ["Τηλέφωνο", d.phone],
    ["Γλώσσα", d.locale === "el" ? "Ελληνικά" : "English"],
    ...(d.message ? [["Μήνυμα", d.message] as [string, string]] : []),
    ...(d.specialRequests ? [["Ειδικά αιτήματα", d.specialRequests] as [string, string]] : []),
  ];
  const intro = ["Το αίτημα είναι σε κατάσταση «Σε αναμονή». Δεν έχει σταλεί επιβεβαίωση στον πελάτη."];
  const outro = [`Διαχείριση: ${adminUrl}`];
  return {
    subject: `${heading} ${d.reference} — ${d.excursionTitle}`,
    text: plain(heading, intro, rows, outro),
    html: layout({ locale: "el", preheader: `${d.firstName} ${d.lastName}, ${d.participants} άτομα`, badge: "Νέο", tone: "admin", heading, intro, rows, outro }),
  };
}

const P = {
  el: {
    subject: "Λάβαμε το αίτημά σας για ιδιωτική εκδρομή — {ref}",
    badge: "Αίτημα σε επεξεργασία",
    heading: "Ας σχεδιάσουμε μαζί την εκδρομή σας",
    intro: [
      "Γεια σας {name},",
      "Ευχαριστούμε για το αίτημά σας! Η ομάδα της OurWay θα επικοινωνήσει μαζί σας σύντομα για να συζητήσουμε τις ιδέες σας.",
      "Το αίτημα δεν αποτελεί κράτηση ούτε δεσμευτική προσφορά: το πρόγραμμα, η διαθεσιμότητα και η τιμή θα διαμορφωθούν μαζί σας.",
    ],
    reference: "Κωδικός αιτήματος",
    participants: "Άτομα",
    reply: "Για οποιαδήποτε ερώτηση, απαντήστε σε αυτό το email αναφέροντας τον κωδικό σας.",
  },
  en: {
    subject: "We received your private trip request — {ref}",
    badge: "Request received",
    heading: "Let's plan your trip together",
    intro: [
      "Hello {name},",
      "Thank you for your request! The OurWay team will contact you soon to talk through your ideas.",
      "This request is not a booking or a binding quote: the itinerary, availability and price will be shaped together with you.",
    ],
    reference: "Request reference",
    participants: "Group size",
    reply: "If you have any questions, reply to this email and mention your reference.",
  },
} as const;

export function renderPrivateReceived(d: PrivateEmailData): Rendered {
  const c = P[d.locale];
  const intro = c.intro.map((s) => fill(s, d));
  const rows: Array<[string, string]> = [[c.reference, d.reference], [c.participants, String(d.participants)], ...d.details];
  const outro = [c.reply];
  return {
    subject: fill(c.subject, d),
    text: plain(c.heading, intro, rows, outro),
    html: layout({ locale: d.locale, preheader: intro[1], badge: c.badge, tone: "pending", heading: c.heading, intro, rows, outro }),
  };
}

export function renderAdminNewPrivate(d: PrivateEmailData, adminUrl: string): Rendered {
  const heading = "Νέο αίτημα ιδιωτικής εκδρομής";
  const rows: Array<[string, string]> = [
    ["Κωδικός", d.reference],
    ["Όνομα", `${d.firstName} ${d.lastName}`],
    ["Email", d.email],
    ["Τηλέφωνο", d.phone],
    ["Άτομα", String(d.participants)],
    ...d.details,
  ];
  const intro = ["Νέο αίτημα για εκδρομή αποκλειστικά για ομάδα. Κατάσταση: «Νέο αίτημα»."];
  const outro = [`Διαχείριση: ${adminUrl}`];
  return {
    subject: `${heading} ${d.reference} — ${d.firstName} ${d.lastName} (${d.participants} άτομα)`,
    text: plain(heading, intro, rows, outro),
    html: layout({ locale: "el", preheader: `${d.participants} άτομα`, badge: "Νέο", tone: "admin", heading, intro, rows, outro }),
  };
}
