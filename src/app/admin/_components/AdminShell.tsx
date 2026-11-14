"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarRange,
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { signOut } from "../_actions/auth";
import { t } from "../_lib/strings";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: t.nav.dashboard, icon: LayoutDashboard, exact: true },
  { href: "/admin/excursions", label: t.nav.excursions, icon: CalendarRange },
  { href: "/admin/announcements", label: t.nav.announcements, icon: Megaphone },
  { href: "/admin/media", label: t.nav.media, icon: ImageIcon },
  { href: "/admin/settings", label: t.nav.settings, icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active ? "bg-bone/10 text-bone" : "text-bone/70 hover:bg-bone/5 hover:text-bone",
              )}
            >
              <Icon aria-hidden className="size-4.5" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarFooter({ email }: { email: string }) {
  return (
    <div className="space-y-1 border-t border-bone/10 pt-4">
      <a
        href="/el"
        target="_blank"
        rel="noopener"
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-bone/70 hover:bg-bone/5 hover:text-bone"
      >
        <ExternalLink aria-hidden className="size-4.5" />
        {t.nav.viewSite}
      </a>
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-bone/70 hover:bg-bone/5 hover:text-bone"
        >
          <LogOut aria-hidden className="size-4.5" />
          {t.nav.logout}
        </button>
      </form>
      <p className="truncate px-3 pt-2 text-xs text-fog" title={email}>
        {email}
      </p>
    </div>
  );
}

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between bg-forest p-4 text-bone lg:flex">
        <div>
          <Link href="/admin" className="mb-8 flex items-center gap-2 px-3 pt-2 text-lg font-semibold">
            Our<span className="text-lichen">Way</span>
            <span className="rounded bg-bone/10 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-fog">Admin</span>
          </Link>
          <nav aria-label={t.nav.menu}>
            <NavLinks />
          </nav>
        </div>
        <SidebarFooter email={email} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-forest px-4 text-bone lg:hidden">
        <Link href="/admin" className="font-semibold">
          Our<span className="text-lichen">Way</span> <span className="text-xs text-fog">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.nav.menu}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-bone/10"
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t.nav.menu}>
          <button
            type="button"
            aria-label={t.nav.closeMenu}
            className="absolute inset-0 bg-ink/50"
            onClick={() => setOpen(false)}
          />
          <div id="admin-mobile-nav" className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-forest p-4 text-bone">
            <div>
              <div className="mb-6 flex items-center justify-between px-3">
                <span className="font-semibold">{t.brand}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t.nav.closeMenu}
                  className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-bone/10"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <nav aria-label={t.nav.menu}>
                <NavLinks onNavigate={() => setOpen(false)} />
              </nav>
            </div>
            <SidebarFooter email={email} />
          </div>
        </div>
      )}

      <main id="admin-main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
