import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { siteConfig } from "@/lib/site";
import { t } from "../_lib/strings";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: t.login.title };
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const admin = await getAdmin();
  if (admin.status === "admin") redirect("/admin");
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const initialError =
    !isSupabaseConfigured ? "notConfigured" : sp.error === "forbidden" || admin.status === "forbidden" ? "forbidden" : undefined;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-forest px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center text-bone">
          {siteConfig.logo.src && (
            <span className="mb-5 block size-20 overflow-hidden rounded-full bg-white">
              <Image src={siteConfig.logo.src} alt="OurWay" width={160} height={160} className="size-full object-contain" priority />
            </span>
          )}
          <h1 className="text-2xl font-semibold">{t.login.title}</h1>
          <p className="mt-2 text-sm text-fog">{t.login.subtitle}</p>
        </div>
        <div className="admin-card p-6 sm:p-8">
          <LoginForm next={next} initialError={initialError} />
        </div>
      </div>
    </main>
  );
}
