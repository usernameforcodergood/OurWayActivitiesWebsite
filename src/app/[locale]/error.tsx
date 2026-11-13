"use client";

import { useParams } from "next/navigation";
import { error as elError } from "@/messages/el.json";
import { error as enError } from "@/messages/en.json";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const t = params?.locale === "en" ? enError : elError;

  return (
    <section className="flex min-h-[80svh] items-center bg-ink pt-[var(--header-h)] text-bone">
      <div className="container-x max-w-2xl">
        <h1 className="text-display-md">{t.title}</h1>
        <p className="text-lead mt-6 text-bone/75">{t.body}</p>
        <Button type="button" onClick={reset} className="mt-10" icon={false}>
          {t.retry}
        </Button>
      </div>
    </section>
  );
}
