import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "../_components/AdminShell";
import { ToastProvider } from "../_components/Toast";

export const instant = false;

/** Every page in this group is admin-only; checked on the server. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <ToastProvider>
      <AdminShell email={admin.email}>{children}</AdminShell>
    </ToastProvider>
  );
}
