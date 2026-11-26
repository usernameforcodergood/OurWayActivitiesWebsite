import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { COMING_SOON_ROUTE, isComingSoonMode } from "@/lib/coming-soon";

/**
 * Runs only on /admin and preview routes. Refreshes the Supabase session
 * cookie and performs an optimistic redirect to the login page when there
 * is no session at all. The real authorization check (is this user an
 * admin?) happens on the server in requireAdmin() and in RLS.
 */
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/forgot-password", "/admin/reset-password"]);

/** Admin dashboard and admin draft previews: always handled by the admin logic below. */
const ADMIN_PATH = /^\/(?:admin|(?:el|en)\/preview)(?:\/|$)/;

/**
 * Pre-launch Coming Soon mode (COMING_SOON_MODE=true, see src/lib/coming-soon.ts).
 * Public pages keep their URL but render the Coming Soon page, marked noindex
 * and no-store. With the flag off this is a pass-through.
 */
function comingSoonGate(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isComingSoonRoute = pathname === COMING_SOON_ROUTE || pathname.startsWith(`${COMING_SOON_ROUTE}/`);

  if (!isComingSoonMode()) {
    // The internal route is not a public page once the site is launched.
    return isComingSoonRoute ? NextResponse.redirect(new URL(`/${defaultLocale}`, request.url)) : NextResponse.next();
  }

  const first = pathname.split("/")[isComingSoonRoute ? 2 : 1] ?? "";
  const locale = hasLocale(first) ? first : defaultLocale;
  // Note: Next serves a rewritten, prerendered page with 200 (a custom status
  // here is ignored), so "noindex" is what keeps it out of search results.
  const response = NextResponse.rewrite(new URL(`${COMING_SOON_ROUTE}/${locale}`, request.url));
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function proxy(request: NextRequest) {
  if (!ADMIN_PATH.test(request.nextUrl.pathname)) return comingSoonGate(request);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Signed-out admin pages: login and password recovery.
  const isPublic = PUBLIC_ADMIN_PATHS.has(request.nextUrl.pathname);

  if (!url || !key) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublic) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  // Reset links carry a one-time token in the URL: never leak it via Referer.
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/(el|en)/preview/:path*",
    // Public pages, for Coming Soon mode. Skips /api, /admin, Next internals
    // and any path with a file extension (images, video, robots.txt, sitemap).
    "/((?!api(?:/|$)|admin(?:/|$)|_next/|.*\\..*).*)",
  ],
};
