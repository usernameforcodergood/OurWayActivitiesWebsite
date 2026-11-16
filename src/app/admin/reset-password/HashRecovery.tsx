"use client";

import { useEffect, useState, type ReactNode } from "react";
import { acceptRecoveryTokens } from "../_actions/recovery";

/**
 * Handles links from Supabase's default "Reset password" email, which put the
 * recovery session in the URL fragment (#access_token=…&type=recovery) where
 * the server cannot see it. The tokens are removed from the address bar at
 * once, checked on the server, and the page reloads into the password form.
 * Anything else shows `fallback` (the "invalid link" message).
 */
export function HashRecovery({ fallback, checking }: { fallback: ReactNode; checking: string }) {
  const [state, setState] = useState<"checking" | "invalid">("checking");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    const clean = window.location.pathname + window.location.search;
    if (window.location.hash) window.history.replaceState(null, "", clean);

    const usable = access && refresh && hash.get("type") === "recovery" && !hash.get("error");
    const accepted = usable
      ? acceptRecoveryTokens(access, refresh).then((r) => r.ok, () => false)
      : Promise.resolve(false);
    accepted.then((ok) => (ok ? window.location.replace(clean) : setState("invalid")));
  }, []);

  if (state === "invalid") return <>{fallback}</>;
  return (
    <p role="status" aria-live="polite" className="text-center text-sm text-bark">
      {checking}
    </p>
  );
}
