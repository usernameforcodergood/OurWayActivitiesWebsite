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
    sitemap.ts robots.ts icon.jpg
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
- **No secret keys in the app.** The website only uses the public URL and publishable key. Admin writes run with the logged-in admin's own session. The database connection string is used only by the two local setup scripts and must not be added to Vercel.
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

On Vercel, add only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plus the email variables).

### Placeholders still in use

- **Photography**: Unsplash images (free under the Unsplash License) illustrate the mood. They do **not** show confirmed OurWay places or activities. Replace them with OurWay's own photos.
- **Logo**: `public/brand/ourway-logo.jpg` (300×300 JPG on white, shown as a round badge). A transparent PNG or SVG at a higher resolution would look sharper.
- **Privacy policy**: interim text, clearly marked. It needs legal review. Nothing on the site claims GDPR compliance.
- **Experiences / announcements**: none until the administrator publishes them in `/admin`. The pages show an honest "in progress" state meanwhile.

## Contact form and email setup

The form validates on the client and again on the server (`src/app/api/contact/route.ts`). Spam is blocked by a honeypot field, a minimum fill time and a per-IP rate limit (best effort, in memory). Success appears **only** after the email provider confirms delivery. Without credentials, the API returns `503 notConfigured` and the visitor is told the message was **not** sent. Submissions are never stored or logged.

1. Create an account at <https://resend.com> and an API key.
2. Set `RESEND_API_KEY` and `CONTACT_EMAIL` (the inbox that receives inquiries, e.g. `ourway.activities@gmail.com`).
3. For production, verify the OurWay domain in Resend (it adds DNS records) and set `CONTACT_FROM_EMAIL="OurWay <hello@your-domain.gr>"`. Until then the shared `onboarding@resend.dev` sender is used, and Resend only delivers to the account owner's own address.

To change provider, implement `EmailProvider` in `src/lib/email.ts`.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project → Import** the repository. The framework is detected as Next.js; keep the default build settings.
3. Under **Settings → Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `CONTACT_EMAIL`, optionally `CONTACT_FROM_EMAIL`, and `NEXT_PUBLIC_SITE_URL` (the final domain, e.g. `https://www.ourway.gr`). Do **not** add `SUPABASE_DB_URL`.
4. Deploy. Every push to `main` deploys to production; other branches get preview URLs.

## Connecting the domain

1. Vercel → Project → **Settings → Domains** → add `your-domain.gr` and `www.your-domain.gr`.
2. At the domain registrar's DNS panel, add the records Vercel shows. Typically:
   - apex `your-domain.gr`: **A** record → `76.76.21.21`
   - `www`: **CNAME** → `cname.vercel-dns.com`

   Always use the exact values shown in your Vercel dashboard.
3. Choose the primary domain in Vercel (e.g. `www`) and let the other one redirect to it.
4. HTTPS certificates are issued automatically once DNS propagates (minutes to a few hours).
5. Set `NEXT_PUBLIC_SITE_URL` to the primary domain and redeploy, so canonical URLs, hreflang tags and the sitemap use it.

DNS changes need the domain owner's access and are not made by this project.

## SEO

Each page has localised title and description, a canonical URL, `hreflang` alternates (`el`, `en`, `x-default` → Greek), Open Graph and Twitter cards, `/sitemap.xml` with language alternates, and `/robots.txt`. Structured data is limited to a minimal, accurate `Organization` (name and URL only).
