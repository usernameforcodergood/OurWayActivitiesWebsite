/**
 * PRE-LAUNCH "COMING SOON" MODE
 * -----------------------------
 * The single switch is the environment variable COMING_SOON_MODE.
 *
 *   COMING_SOON_MODE=true   → every public page (/, /el/..., /en/...) shows the
 *                             Coming Soon page at its own URL (noindex,
 *                             no-store). Nothing is deleted or changed.
 *   unset / anything else   → the full website, exactly as before (= launch).
 *
 * Never affected: /admin (dashboard, login, password recovery), the admin
 * draft previews (/el|en/preview/...), /api routes, images, video and other
 * static files.
 *
 * On Netlify: Site configuration → Environment variables → COMING_SOON_MODE,
 * then Deploys → Trigger deploy (env changes apply on the next deploy).
 * The gate lives in src/proxy.ts; the page in src/app/coming-soon/[locale].
 * See README → "Coming Soon mode".
 */
export function isComingSoonMode(): boolean {
  return process.env.COMING_SOON_MODE === "true";
}

/** Internal route of the Coming Soon page (served via rewrite, never linked). */
export const COMING_SOON_ROUTE = "/coming-soon";
