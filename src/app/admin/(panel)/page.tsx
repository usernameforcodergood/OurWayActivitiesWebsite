import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, FileClock, Megaphone, Plus, Upload, CheckCircle2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { fmt, t } from "../_lib/strings";
import { getDashboardData } from "../_lib/queries";
import { BtnLink, Card, PageHeader, StatusBadge, formatDate } from "../_components/ui";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.dashboard.title };

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const d = await getDashboardData();

  const stats = [
    { label: t.dashboard.totalExcursions, value: d.total, icon: CalendarRange, href: "/admin/excursions" },
    { label: t.dashboard.publishedExcursions, value: d.published, icon: CheckCircle2, href: "/admin/excursions?status=published" },
    { label: t.dashboard.draftExcursions, value: d.drafts, icon: FileClock, href: "/admin/excursions?status=draft" },
    {
      label: t.dashboard.totalAnnouncements,
      value: d.annTotal,
      icon: Megaphone,
      href: "/admin/announcements",
      sub: fmt(t.dashboard.activeAnnouncements, { count: d.annActive }),
    },
  ];

  return (
    <>
      <PageHeader title={t.dashboard.title} description={`${t.dashboard.hello}, ${admin.email}`} />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, sub }) => (
          <li key={label}>
            <Link href={href} className="admin-card flex h-full flex-col gap-3 p-5 transition hover:ring-2 hover:ring-lagoon/30">
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
        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.dashboard.recent}</h2>
          {d.recent.length === 0 ? (
            <p className="text-sm text-bark">{t.dashboard.recentEmpty}</p>
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
                        {r.kind === "excursion" ? t.dashboard.typeExcursion : t.dashboard.typeAnnouncement} ·{" "}
                        {formatDate(r.updated_at, true)}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{t.dashboard.quick}</h2>
          <div className="flex flex-col gap-2">
            <BtnLink href="/admin/excursions/new">
              <Plus aria-hidden className="size-4" />
              {t.dashboard.newExcursion}
            </BtnLink>
            <BtnLink href="/admin/announcements/new" variant="secondary">
              <Plus aria-hidden className="size-4" />
              {t.dashboard.newAnnouncement}
            </BtnLink>
            <BtnLink href="/admin/media" variant="secondary">
              <Upload aria-hidden className="size-4" />
              {t.dashboard.uploadMedia}
            </BtnLink>
          </div>
        </Card>
      </div>
    </>
  );
}
