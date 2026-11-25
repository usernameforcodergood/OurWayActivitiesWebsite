# OurWayActivitiesWebsite

OurWay is a developing Greek outdoor, nature and experiential activities company focused on creating meaningful experiences that connect people with nature, local culture, places and communities.

The purpose of the website is to establish a distinctive, premium digital identity for OurWay and communicate its philosophy: an experience is much more than simply visiting a destination or participating in an activity. It is about discovering a place, experiencing its environment, understanding its culture and connecting with the people and stories that make it unique.

The website should position OurWay as a modern, adventurous and experience-driven brand rather than a conventional hiking tour operator or travel agency.

The project requires a premium, cinematic and highly interactive website, inspired by the visual storytelling and presentation quality of Politis Out of Home and the frontend development, motion design and interaction quality of Charisiss.

Wanderlust Activities and Outdoor Activities Greece serve as additional references for activity discovery, destination presentation and user navigation.

The visual identity should combine bold editorial typography, immersive outdoor photography, dark natural colour palettes, asymmetric layouts, large visual sections and carefully choreographed scroll-driven animations.

The website must feature sophisticated interactions, including alternating image and text sections, parallax effects, image reveals, pinned storytelling sequences, smooth transitions and responsive motion design.

The technical foundation will use Next.js, TypeScript, Tailwind CSS, GSAP, ScrollTrigger and Framer Motion, with a scalable architecture and a complete Greek and English experience.

Greek will be the primary language, with English available through a functional language switcher.

The website will initially include a homepage, activities, individual experience pages, destinations, about, gallery and contact sections.

A prominent booking/inquiry call-to-action will guide visitors to a professional contact form. A full online booking engine is not required at this stage.

Because OurWay is still developing, its final activities and services are not yet fully defined. The website must therefore remain flexible and scalable, avoiding invented company information, fictional activities, prices, testimonials or statistics.

The ultimate goal is to create a visually distinctive, technically sophisticated and production-ready website that makes visitors feel invited to discover and experience something beyond an ordinary trip.

**OurWay is not just about where you go. It is about what you experience along the way.**

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components / Partial Prerendering, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 with design tokens in `src/app/globals.css` |
| Scroll animation | GSAP 3 + ScrollTrigger + SplitText (`@gsap/react`) |
| UI motion | Framer Motion (menu, lightbox, form states, cursor preview) |
| Smooth scroll | Lenis (wheel only, synced to GSAP's ticker, off with reduced motion) |
| Forms | React Hook Form + Zod (one schema shared by client and server) |
| Email | Resend, behind a provider interface (`src/lib/email.ts`) |
| Icons | Lucide React |
| i18n | Next.js native dictionaries, `/el` (default) and `/en` |

Requires **Node.js 20+** (developed on Node 26).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # http://localhost:3000 → redirects to /el
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`, `npx tsc --noEmit`.

## Project structure

```
src/
  app/
    [locale]/                 Every page lives under /el or /en
      layout.tsx              Root layout: fonts, <html lang>, nav, footer, Lenis
      page.tsx                Homepage
      activities/ [slug]/     Experiences list + reusable experience template
      destinations/ about/ gallery/ contact/ privacy/
      not-found.tsx error.tsx [...rest]/   Localised 404 / error states
    api/contact/route.ts      Contact form endpoint (validation, spam guards, email)
    sitemap.ts robots.ts icon.png apple-icon.png
  components/
    layout/      Navbar, Footer, LanguageSwitcher, SmoothScroll, BackToTop
    sections/    Hero, BrandPhilosophy, StorySection, ExperienceShowcase,
                 PinnedStorySection, DiscoverSection, CTASection
    animations/  TextReveal, ScrubText, ImageReveal, ExpandingImage,
                 LayeredImages, ParallaxBackground
    activities/  ExperienceCard
    gallery/     GalleryGrid (masonry + accessible lightbox)
    forms/       ContactForm, FormField
    ui/          Button, SectionLabel, PageHero, Wordmark
  content/       media.ts (image registry), activities.ts, destinations.ts, types.ts
  i18n/          config, routes, dictionaries, compile-time message check
  messages/      el.json, en.json  <- all interface and page copy
  lib/           site.ts (company details), metadata.ts, validation.ts, email.ts, gsap.ts
```

## Design system

Defined once in `src/app/globals.css` (`@theme`) and used through Tailwind utilities.

- **Colour**: `ink` #0c1311 (base), `forest` #12211d, `moss` #1e3530, `stone` #ebe6da, `limestone` #f5f2ea, `bone` #f2efe7 (text on dark), `fog` #a9afa4 (muted on dark), `bark` #4a4a3f (muted on light). Accents: `lichen` #8ccbb8 (mint-teal from the logo), `lagoon` #2fa3b0 (logo arrow teal), `sand` #dcc8a2 (CTA), `clay` #b98458. All body-text pairs are 7:1 or better.
- **Type**: Noto Serif Display (variable, Greek + Latin) for headlines; Manrope (Greek + Latin) for UI and body text. Fluid steps: `text-display-xl/lg/md/sm`, `text-lead`, `text-eyebrow`.
- **Layout**: `container-x` (max 96rem, fluid gutter), `section-y` (fluid vertical rhythm), 12-column grid, sections that alternate dark and light.
- **Motion**: easing `expo.out` / `--ease-out-expo` (0.16, 1, 0.3, 1); reveals 1.2–1.6s; scrubbed effects are tied to scroll position.
- **Breakpoints**: Tailwind defaults (sm 640, md 768, lg 1024, xl 1280) plus `xs` 416.

## Animation overview

| Where | Technique |
| --- | --- |
| Hero | Image settles from a slow zoom, headline rises line by line out of SplitText masks, scrubbed parallax and fade on scroll-out |
| Philosophy | Words light up as you scroll (scrubbed SplitText) |
| Story blocks | Directional clip-path reveals + inner zoom + parallax; a full-bleed image that expands from a rounded frame; three layered images at different scroll speeds |
| Experience themes | Rule lines draw in, staggered rows; on desktop a cursor-following image preview (Framer Motion springs) |
| The journey | Pinned for about 3 viewport heights: chapters hand over, images wipe up, a progress rail fills, snaps per chapter. **Desktop only**; mobile gets a natural vertical sequence |
| Discover / CTA | Collage reveals with hover zoom; parallax background |
| Nav / menu | Hides on scroll down, reveals on scroll up; full-screen menu with clip-path and staggered links |

Every animation runs inside `gsap.matchMedia()` and is reverted on unmount. With `prefers-reduced-motion`, all motion and Lenis are off and all content is visible. Without JavaScript, all content is visible too.

## Editing content

- **Excursions, announcements, uploaded images, contact details**: managed in the **admin dashboard** at `/admin` (see below). No code changes needed.
- **Fixed page copy** (headlines, philosophy texts, labels): `src/messages/el.json` and `en.json`. They must keep the same shape; `npx tsc` fails if a key is missing in one language.
- **Built-in mood photography** (hero, story sections, gallery page): `src/content/media.ts`. Each photo has a semantic key. To replace one, put the file in `public/images/`, change its `src` (e.g. `/images/hero.jpg`), and update `width`, `height` and the Greek/English `alt`. The gallery order is `galleryKeys` in the same file.
- **Logo and fallback contact details**: `src/lib/site.ts`.

## Admin dashboard (CMS)

A private dashboard at **`/admin`** (Greek interface) for managing the site without touching code:

| Section | What the administrator can do |
| --- | --- |
| Πίνακας ελέγχου (Dashboard) | Counts of excursions (total / published / drafts) and announcements (with how many are live), recent changes, quick actions |
| Εκδρομές (Excursions) | Create, edit, delete (with confirmation), save as draft, publish, unpublish, preview before publishing; Greek and English content in separate tabs; cover image + ordered gallery; destination, category, duration, difficulty, participants, price, available dates, extra info (all optional); featured toggle; URL slug (auto-generated from the Greek title, transliterated) |
| Ανακοινώσεις (Announcements) | Same editing flow, plus publication date (can be in the future) and optional expiry date, both in Greek time |
| Πολυμέσα (Media) | Upload multiple images, edit alt text in both languages, see where each image is used, delete |
| Ρυθμίσεις (Settings) | Public contact details and social links (footer + contact page), change own password |

Lists support search, status filter, sorting and pagination.

**How content reaches the website.** Published excursions appear on `/activities`, on their own page `/activities/<slug>`, on the homepage (featured first) and grouped by destination on `/destinations`. Active announcements appear on `/news`, `/news/<slug>` and on the homepage. Each save clears the related cache, so changes show immediately. Announcements also honour their publish and expiry times within a few minutes.

**Languages.** Each excursion or announcement has separate Greek and English fields. A language version goes public only when it has a **title and a short description** in that language. Incomplete translations are never shown as finished pages: the item is left out of that language's lists, and its page redirects to the list.

### Architecture and security

- **Supabase** provides the PostgreSQL database, email/password login and image storage. The schema, Row Level Security policies and storage bucket are in `supabase/migrations/0001_cms.sql`.
- **Row Level Security**: visitors can only **read** published excursions and currently active announcements. Only users listed in `admin_users` can create, change or delete anything, including uploads in the `media` storage bucket. The database enforces this independently of the website code.
- **Server-side checks**: every admin page, preview and Server Action calls `requireAdmin()` (`src/lib/auth.ts`). It verifies the session with Supabase Auth and checks `admin_users`. `src/proxy.ts` refreshes the session cookie and redirects anonymous visitors to `/admin/login` early. Admin pages are always rendered per request, never cached, and send `noindex`.
- **No service-role key in the app.** The website uses the public URL and publishable key; admin writes run with the logged-in admin's own session. The only server secret is `ADMIN_RECOVERY_KEY` (see *Admin password recovery*), which can do nothing except tell the server whether an email belongs to an admin. The database connection string is used only by the local setup scripts and must not be added to Vercel.
- **No public registration.** Admin accounts are created by the developer (see below).
- **Images** are resized in the browser (max 2400px, WebP) and uploaded straight to Supabase Storage, then served through `next/image`. Nothing is stored inside the deployment.

### Setting up Supabase (one time)

1. Create a free project at <https://supabase.com> (region: Frankfurt / `eu-central-1`).
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: **Project Settings → API Keys** (or the **Connect** button).
   - `SUPABASE_DB_URL`: **Connect → Session pooler** connection string, with your database password filled in.
3. Create the tables, security policies and image bucket:
   ```bash
   npm run db:setup
   ```
   (Alternatively, paste `supabase/migrations/0001_cms.sql` into **SQL Editor → Run**.)
4. Create the administrator: **Authentication → Users → Add user → Create new user**. Enter the email and a strong password, and tick **Auto Confirm User**. Then grant admin rights:
   ```bash
   npm run admin:grant -- name@example.com
   ```
   `npm run admin:grant -- --list` shows all admins, and `-- email --revoke` removes rights. More admins can be added the same way.
5. Recommended: **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up", so nobody can create accounts through the Supabase API.
6. Restart `npm run dev` and sign in at <http://localhost:3000/admin>.

On Vercel, add only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `ADMIN_RECOVERY_KEY` (plus the email variables).

### Admin password recovery

`/admin/login` → **"Ξέχασες τον κωδικό σου;"** → `/admin/forgot-password` → email → `/admin/reset-password`. The pages are Greek by default, English with `?lang=en` (EL/EN switch top right). The flow uses Supabase Auth's own recovery (`resetPasswordForEmail()` + `verifyOtp()`); there is no custom token system.

How it is secured:

- **Admins only.** Before anything is sent, the server asks the database (`admin_recovery_eligible()`, migration `0002`) whether the email belongs to a confirmed, non-banned user in `admin_users`. The function only answers callers holding the server-only `ADMIN_RECOVERY_KEY`, so nobody can use the public API to test which emails are admins. Non-admin accounts never get an email, and if a non-admin somehow holds a valid recovery token, the reset page signs them out without changing anything. Recovery can never create an admin: admin rights come only from `npm run admin:grant`.
- **No account enumeration.** Every valid email gets the same message, in the same (padded) time, and no cookie is set.
- **Single-use, time-limited links.** Supabase creates, expires and invalidates the token. Opening the link does **not** use it up (so email link scanners can't burn it); it is verified only when the new password is submitted, after validation (≥ 12 characters, both fields match).
- **After the change** every session of that account is signed out (`signOut({ scope: "global" })`) and the admin must sign in with the new password. Passwords are only ever handled by Supabase Auth (hashed); none is sent by email.

One-time setup (needs the Supabase dashboard; the website code cannot change these settings):

1. Apply the new migration and create the recovery key (writes `ADMIN_RECOVERY_KEY` to `.env.local`; copy the same value to Vercel, Production):
   ```bash
   npm run db:setup
   ```
   ```bash
   npm run admin:recovery-key
   ```
2. **Authentication → URL Configuration**: set **Site URL** to the live domain and add these **Redirect URLs**: `https://<your-domain>/admin/reset-password` and `http://localhost:3000/admin/reset-password`.
3. **Authentication → Emails → SMTP Settings**: enable a custom SMTP server. Supabase's built-in sender only delivers to the project's team members, a few emails per hour, and doesn't allow template edits. With Resend: host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key, sender = an address on the verified OurWay domain.
4. **Authentication → Emails → Templates → Reset password** (editable once custom SMTP is on): subject `Reset your OurWay administrator password`, body = the contents of `supabase/templates/reset-password.html`. Until then Supabase's default email is sent; its link also works (the reset page accepts both link formats), but it is unbranded and is used up as soon as it is opened.
5. The link lifetime is Supabase's **Email OTP expiration** setting (Authentication → Sign In / Providers → Email); the email deliberately does not state a fixed time.

### Placeholders still in use

- **Photography**: Unsplash images (free under the Unsplash License) illustrate the mood. They do **not** show confirmed OurWay places or activities. Replace them with OurWay's own photos.
- **Logo**: `public/brand/ourway-logo.webp` (1200×1200 on white, shown as a round badge; favicons in `src/app/icon.png` and `apple-icon.png`). A transparent PNG or SVG would allow it to sit directly on dark backgrounds.
- **Privacy policy**: interim text, clearly marked. It needs legal review. Nothing on the site claims GDPR compliance.
- **Experiences / announcements**: none until the administrator publishes them in `/admin`. The pages show an honest "in progress" state meanwhile.

## Bookings, events and tailor-made experiences

OurWay takes **requests, not payments**. There is no checkout, card form or payment provider anywhere in the code, and no booking is ever confirmed automatically.

**Two ways to travel**

1. **Scheduled excursions and events.** Each excursion (Admin → Εκδρομές) has a *type* (excursion / event) and a *booking mode*:
   - *Αίτηση κράτησης με ημερομηνίες*: the page lists the upcoming departures with live free places and a «Κράτηση Θέσης» / «Αίτηση Κράτησης» button. The visitor picks a departure and the number of people, sees the indicative total, and sends a request.
   - *Εκδήλωση ενδιαφέροντος*: no dates, an «Εκδήλωση Ενδιαφέροντος» form (for announcements or events that aren't final yet).
   - *Μόνο πληροφορίες*: no form, a link to the contact page.
   Departures (date, optional times, price, capacity, minimum group, booking deadline, status open / full / cancelled / completed) are managed under the excursion's edit page. Missing departure prices fall back to the excursion's base price.
2. **Tailor-Made Experiences.** «Δημιουργήστε τη Δική σας Εμπειρία» (`/tailor-made`, in the main menu and on the homepage) explains the service and holds the request form: full name, email, phone, type of experience, desired date or range, participants and a description are required; destination, budget and extra requirements are optional. Requests land in Admin → **Tailor-Made Requests**, kept apart from excursion bookings (statuses New → In review → Contacted → Quotation sent → Confirmed → Completed, or Rejected). Admins can search, filter by status and category, sort by date or status, edit the details, keep an internal proposal (never sent automatically) and delete spam or test requests. The old `/private-trips` and `/admin/private-requests` links redirect here.

**«Ενδιαφέρομαι».** The button in the header, mobile menu and footer opens a dialog with two paths: design your own experience (→ the tailor-made form) or discover the organised experiences (→ `/activities`, then the normal booking flow).

**Request lifecycle (Admin → Κρατήσεις).** Every submission is saved as *Σε αναμονή* (pending) with a reference like `OW-7K3M9Q` (tailor-made: `TM-…`; older requests keep `PG-…`). The admin confirms, rejects or cancels it, optionally with a message to the customer; completed bookings can be marked as such. Each change is written to the status history, and the customer email for it is sent only after the change succeeds. Internal notes are visible only in the admin.

**Capacity and the hold policy.** Places are counted in the database, never in the browser:
- *Held places* = confirmed participants + pending participants whose **72-hour hold** has not expired (the hold never extends past the departure itself).
- Rejected, cancelled and expired-hold requests release their places. An expired request stays pending (the admin can still confirm it if places are free, or renew the hold); confirming never counts the same people twice.
- `submit_booking_request()` locks the departure row while it checks and inserts, so simultaneous requests can't overbook. The admin can't lower a departure's capacity below its held places, or delete departures/excursions that have requests (cancel or unpublish them instead).
- Requests are refused for full, cancelled, completed or past departures and after the booking deadline. Repeat submissions of the same form return the same reference, and the same email can't request the same departure twice within 30 minutes.

**Emails** (Resend, `src/lib/bookings/emails.ts`, Greek + English): new-request notification to `BOOKINGS_EMAIL` (or `CONTACT_EMAIL`), receipt to the customer (it says plainly that the booking is *not* confirmed yet), then confirmation / rejection / cancellation emails sent by admin actions. Every attempt is recorded with its real result. Failures appear on the dashboard and on the request page (with a resend button for bookings), and nothing is ever reported as sent unless Resend accepted it. If email isn't configured, requests are still saved and the visitor is told no receipt email could be sent.

**Security.** Visitors can't read any booking or personal data: they can only call `submit_booking_request()` / `submit_private_request()` (security-definer functions that validate everything again) and `public_departures()` (counts only). Bookings, private requests, notes, history and the email log are readable only by admins (RLS), and statuses change only through `admin_*` functions that check `is_admin()`.

**Form submissions use the server's secret key.** The booking and tailor-made API routes save requests with the Supabase secret key (`SUPABASE_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`), which exists only on the server. Since migration `0005`, the public key can no longer call `submit_*()` or `record_submission_email()`, so nobody can skip the honeypot, fill timer and rate limit by calling the database directly. On Vercel the key is set by the Supabase integration. To run the forms locally, copy it from Supabase → Project Settings → API keys into `.env.local`; without it, the forms answer "not available yet".

**Tailor-made setup:** apply `supabase/migrations/0004_tailor_made.sql` **before deploying** the version that contains it. It reuses the `private_requests` table (no parallel table), adds the category and extra-requirements fields, maps the old statuses (Planning → In review, Proposal sent → Quotation sent, Accepted → Confirmed) and lets admins edit and delete requests. Safe to re-run.

**Reusable excursions, calendar and archiving (migration `0010`):** an excursion is written once (description, programme, photos, inclusions) and each date is a separate *departure* with its own start/end date, times, price, deposit, places, deadline and requests. "Repeat" in Admin → excursion → Dates copies a date's settings into a new date; old dates and their requests are never changed. The dashboard home has a month/week calendar of all dates with a quick "repeat on a new date" form. On a date's start day (Europe/Athens) a `pg_cron` job (`ourway-archive-started-departures`, every 15 minutes) marks it *completed*; nothing is deleted. The public site also filters by date, so a started date disappears even between job runs, and a database trigger refuses new requests for it. A scheduled excursion whose every date has started leaves the public lists (its page and history stay). Apply `0010` **before deploying** the version that contains it.

**Setup:** apply `supabase/migrations/0003_bookings.sql` (`npm run db:setup`, or paste it into Supabase → SQL Editor). It is safe to re-run, and it copies any dates in the old "Available dates" list into departures (the old list is kept, so the previously deployed site keeps working until you deploy). **Apply it before deploying this version**: the site's excursion queries depend on the new `departures` table.

## Website analytics (Admin → Αναλυτικά Στατιστικά)

First-party, consent-based analytics stored in our own Supabase database. There is no Google Analytics or other third-party tracker.

**Consent first.** On a visitor's first visit a banner offers **Αποδοχή / Απόρριψη**, with equal weight. Nothing is stored on the device and nothing is sent until the visitor accepts. «Ρυθμίσεις cookies» in the footer reopens the banner. Declining after accepting stops tracking at once, removes the browser's ids and calls `/api/collect/forget`, which deletes everything recorded under that visitor id. The choice is kept in `localStorage` (`ow_consent`). Bump `CONSENT_VERSION` in `src/lib/analytics/shared.ts` to ask everyone again.

**How it works**
- `src/lib/analytics/client.ts` is the only tracker. It records page views on every route change, engaged (visible) time per page, and a fixed list of events: `session_start`, `excursion_view`, `booking_button_click`, `booking_form_open`, `booking_form_start`, `booking_form_submit`, `search_performed` and `filter_applied`. Events are batched and sent with `fetch(keepalive)`, so nothing blocks the page.
- `POST /api/collect` drops bots, signed-in (admin) browsers, other origins and floods. It validates every event against a fixed schema and keeps only paths plus the five UTM tags. On the server it derives the traffic channel, device/browser/OS and country/region/city from Vercel's geo headers. **The IP address is never stored.** Browsers that opened `/admin` are marked internal and never tracked.
- `booking_request_success` / `booking_request_failure` are recorded **by the server** in `/api/bookings`, after the database answers. They are recorded only for consenting visitors, and a success only for a real, newly saved booking. A unique index on `booking_id` makes it count exactly once, even across retries.
- The dashboard reads only aggregates through `analytics_*` database functions that check `is_admin()` and cap the range at 400 days. With the public key, the event tables can be neither read nor written.
- Retention: a nightly `pg_cron` job (`analytics-retention`) deletes raw data older than 13 months.

**Setup:** apply `supabase/migrations/0013_website_analytics.sql` in Supabase → SQL Editor **before deploying** the version that contains it. No accounts or API keys are needed; it uses the existing `SUPABASE_SECRET_KEY`. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=false` to switch everything off (no banner, no tracking). Location data exists only on Vercel; locally every visit shows as "Άγνωστο".

**Limits to keep in mind:** only consenting visitors are counted, so totals are lower than real traffic. A visitor who clears storage or switches device counts as new. Page-to-page navigation is shown as the most common next steps, not full paths.

## Contact form and email setup

Every visitor request is **database-first**: the contact form, experience requests and tailor-made requests are saved in Supabase (visible in the admin) and success depends only on that save. The forms validate on the client and again on the server; spam is blocked by a honeypot field, a minimum fill time and a per-IP rate limit (best effort, in memory).

Emails are an optional extra, sent through Resend after the save:

- `EMAIL_NOTIFICATIONS_ENABLED=true` turns them on. Anything else means nothing is sent anywhere (the gate is in `src/lib/bookings/notify.ts`).
- `RESEND_API_KEY`: Resend API key. `CONTACT_EMAIL`: the inbox for new-request notifications (`BOOKINGS_EMAIL` overrides it for experience requests).
- `CONTACT_FROM_EMAIL="OurWay <hello@ourway-activities.gr>"`: needs the domain **verified** in Resend (region eu-west-1). Without a verified domain, Resend rejects that sender with 403. The fallback `onboarding@resend.dev` only delivers to the Resend account owner.

Which emails exist: customer receipts for an experience request or an interest request, confirmed / not confirmed / cancelled (sent from the admin), the tailor-made receipt (each in Greek and English), plus admin notifications for each new request and contact message. To see them all at once:

```bash
npm run email:test -- --dry      # render only
npm run email:test               # send all 16 via the shared test sender (to CONTACT_EMAIL)
npm run email:test -- --domain   # send from CONTACT_FROM_EMAIL once the domain is verified
```

To change provider, implement `EmailProvider` in `src/lib/email.ts`.

## Live smoke test

```bash
npm run smoke                                            # https://ourway-activities.gr
npm run smoke -- https://ourwayactivitieswebsite.netlify.app
```

The smoke test checks the public pages, the 404 page and the admin login redirect. For the three request APIs it covers validation, anti-spam, success, duplicate submissions, the duplicate-person guard and capacity. It saves real requests and then deletes exactly those rows, so it needs `SUPABASE_SECRET_KEY` in `.env.local`. With emails enabled, customer copies go to Resend's `delivered@resend.dev` test inbox (no real mailbox), and each run also sends about four admin notifications to `CONTACT_EMAIL`.

## Hosting (Netlify)

Production runs on Netlify (Free plan; Vercel Hobby does not allow commercial use). The project is `ourwayactivitieswebsite` and every push to `main` deploys to production. Server functions run in US East, the free plan's fixed region.

Environment variables (Netlify → Site configuration → Environment variables): `NEXT_PUBLIC_SITE_URL=https://ourway-activities.gr`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ADMIN_RECOVERY_KEY`, `RESEND_API_KEY`, `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL` and `EMAIL_NOTIFICATIONS_ENABLED`. Do **not** add `SUPABASE_DB_URL`.

## Domain (ourway-activities.gr)

Registered at Papaki, which also keeps the DNS (Papaki nameservers). The apex is the primary domain and `www` redirects to it. Records in the Papaki zone:

| Name | Type | Value | Purpose |
| --- | --- | --- | --- |
| `@` | A | `75.2.60.5` | Netlify load balancer |
| `www` | CNAME | `ourwayactivitieswebsite.netlify.app` | Netlify |
| `resend._domainkey` | TXT | DKIM key from Resend | Resend signing (DKIM) |
| `send` | CNAME | `send.forge.rmta.net` | Resend SPF / Return-Path |
| `rsend` | CNAME | `rsend-euw1.forge.rmta.net` | Resend SPF / Return-Path |

Papaki's own mail MX/SPF records stay as they are. Netlify issues the HTTPS certificate automatically once the domain resolves publicly. Supabase Auth → URL configuration uses the domain as Site URL and allows `/admin/reset-password` on the domain and on the netlify.app address.

DNS changes need the domain owner's access and are not made by this project.

## SEO

Each page has localised title and description, a canonical URL, `hreflang` alternates (`el`, `en`, `x-default` → Greek), Open Graph and Twitter cards, `/sitemap.xml` with language alternates, and `/robots.txt`. Structured data is limited to a minimal, accurate `Organization` (name and URL only).
