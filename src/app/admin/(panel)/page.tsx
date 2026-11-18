import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2, ClipboardList, Hourglass, Megaphone, Plus, Upload, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { athensToday } from "@/lib/cms/public";
import { fmt, t } from "../_lib/strings";
import { getDashboardData } from "../_lib/queries";
import { getBookingDashboard } from "../_lib/booking-queries";
import { BookingStatusBadge, BtnLink, Card, PageHeader, StatusBadge, formatDate, formatDay } from "../_components/ui";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.dashboard.title };

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const today = await athensToday();
  const [d, b] = await Promise.all([getDashboardData(), getBookingDashboard(today)]);
  const D = t.dashboard;

  const stats = [
    { label: D.publishedExcursions, value: d.published, icon: CheckCircle2, href: "/admin/excursions?status=published", sub: `${D.totalExcursions}: ${d.total}` },
    { label: D.upcomingDepartures, value: b.upcomingDepartures, icon: CalendarClock, href: "/admin/bookings?sort=departure" },
    { label: D.pendingRequests, value: b.pendingCount, icon: Hourglass, href: "/admin/bookings?status=pending", sub: fmt(D.pendingPeople, { count: b.pendingPeople }), highlight: b.pendingCount > 0 },
    { label: D.confirmedBookings, value: b.confirmedCount, icon: ClipboardList, href: "/admin/bookings?status=confirmed", sub: fmt(D.confirmedPeople, { count: b.confirmedPeople }) },
    { label: D.newPrivate, value: b.newPrivate, icon: Users, href: "/admin/tailor-made?status=new", highlight: b.newPrivate > 0 },
    { label: D.totalAnnouncements, value: d.annTotal, icon: Megaphone, href: "/admin/announcements", sub: fmt(D.activeAnnouncements, { count: d.annActive }) },
  ];

  return (
    <>
      <PageHeader title={D.title} description={`${D.hello}, ${admin.email}`} />

      {b.failures.length > 0 && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden className="size-4" /> {D.emailFailures} ({b.failures.length})
          </p>
          <p className="mt-1 text-xs">{D.emailFailuresHint}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {b.failures.map((f) => (
              <li key={f.id}>
                <Link
                  href={f.booking_id ? `/admin/bookings/${f.booking_id}` : `/admin/tailor-made/${f.private_request_id}`}
                  className="underline underline-offset-2"
                >
                  {(t.bookings.emailKinds as Record<string, string>)[f.kind] ?? f.kind} — {f.recipient} — {formatDate(f.created_at, true)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, href, sub, highlight }) => (
          <li key={label}>
            <Link
              href={href}
              className={`admin-card flex h-full flex-col gap-3 p-5 transition hover:ring-2 hover:ring-lagoon/30 ${highlight ? "ring-2 ring-amber-300" : ""}`}
            >
              <span className="flex items-center justify-between text-sm text-bark">
                {label}
                <Icon aria-hidden className="size-5 text-lagoon" />
              </span>
              <span className="text-3xl font-semibold tabular-nums">{value}</span>
              {sub && <span className="text-xs text-bark">{sub}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">{D.recentBookings}</h2>
            {b.recent.length === 0 ? (
              <p className="text-sm text-bark">{D.recentBookingsEmpty}</p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {b.recent.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/bookings/${r.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-stone/50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          <span className="font-mono text-xs text-lagoon">{r.reference}</span> {r.full_name} · {r.participants}
                        </span>
                        <span className="block truncate text-xs text-bark">
                          {r.excursion_title_el || r.excursion_title_en} · {r.kind === "interest" ? t.bookings.interest : formatDay(r.departure_date, r.departure_time)} ·{" "}
                          {formatDate(r.status_changed_at, true)}
                        </span>
                      </span>
                      <BookingStatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">{D.fullDepartures}</h2>
            {b.full.length === 0 ? (
              <p className="text-sm text-bark">{D.fullDeparturesEmpty}</p>
            ) : (
              <ul className="divide-y divide-ink/8 text-sm">
                {b.full.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/admin/excursions/${f.excursion?.id}`} className="min-w-0 truncate hover:underline">
                      {formatDay(f.departure_date, f.departure_time)} · {f.excursion?.title_el || f.excursion?.title_en}
                    </Link>
                    <span className="shrink-0 tabular-nums text-bark">
                      {f.held}
                      {f.capacity != null && ` / ${f.capacity}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold">{D.recent}</h2>
            {d.recent.length === 0 ? (
              <p className="text-sm text-bark">{D.recentEmpty}</p>
            ) : (
              <ul className="divide-y divide-ink/8">
                {d.recent.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={`/admin/${r.kind === "excursion" ? "excursions" : "announcements"}/${r.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-stone/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.title_el || r.title_en || t.common.untitled}</span>
                        <span className="text-xs text-bark">
                          {r.kind === "excursion" ? D.typeExcursion : D.typeAnnouncement} · {formatDate(r.updated_at, true)}
                        </span>
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="lg:self-start">
          <h2 className="mb-4 text-lg font-semibold">{D.quick}</h2>
          <div className="flex flex-col gap-2">
            <BtnLink href="/admin/excursions/new">
              <Plus aria-hidden className="size-4" />
              {D.newExcursion}
            </BtnLink>
            <BtnLink href="/admin/excursions/new?kind=event" variant="secondary">
              <Plus aria-hidden className="size-4" />
              {D.newEvent}
            </BtnLink>
            <BtnLink href="/admin/bookings?status=pending" variant="secondary">
              <Hourglass aria-hidden className="size-4" />
              {D.viewPending}
            </BtnLink>
            <BtnLink href="/admin/excursions?status=published" variant="secondary">
              <CalendarRange aria-hidden className="size-4" />
              {D.managePublished}
            </BtnLink>
            <BtnLink href="/admin/announcements/new" variant="secondary">
              <Plus aria-hidden className="size-4" />
              {D.newAnnouncement}
            </BtnLink>
            <BtnLink href="/admin/media" variant="secondary">
              <Upload aria-hidden className="size-4" />
              {D.uploadMedia}
            </BtnLink>
          </div>
        </Card>
      </div>
    </>
  );
}
