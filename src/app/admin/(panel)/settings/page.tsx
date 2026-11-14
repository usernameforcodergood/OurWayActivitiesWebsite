import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { fmt, t } from "../../_lib/strings";
import { getSettingsAndAdmins } from "../../_lib/queries";
import { Card, PageHeader } from "../../_components/ui";
import { SettingsForm } from "../../_components/SettingsForm";
import { PasswordForm } from "../../_components/PasswordForm";

// Request-time admin data; navigations may block.
export const instant = false;
export const metadata: Metadata = { title: t.settings.title };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const { settings, adminCount } = await getSettingsAndAdmins();

  return (
    <>
      <PageHeader title={t.settings.title} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <h2 className="text-lg font-semibold">{t.settings.contactTitle}</h2>
          <p className="mb-5 mt-1 text-sm text-bark">{t.settings.contactIntro}</p>
          <SettingsForm initial={settings} />
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">{t.settings.accountTitle}</h2>
            <p className="mb-5 mt-1 break-all text-sm text-bark">{fmt(t.settings.signedInAs, { email: admin.email })}</p>
            <PasswordForm />
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">
              {t.settings.adminsTitle} <span className="text-sm font-normal text-bark">({adminCount})</span>
            </h2>
            <p className="mt-2 text-sm text-bark">{t.settings.adminsIntro}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
