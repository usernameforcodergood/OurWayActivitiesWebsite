import type { Locale } from "@/i18n/config";

/** Fixed notice shown on admin previews, with a switch to the other language. */
export function PreviewBanner({ text, otherLabel, other }: { text: string; otherLabel: string; locale: Locale; other: string }) {
  return (
    <p role="note" className="fixed inset-x-0 bottom-0 z-[45] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-sand px-4 py-2.5 text-center text-sm font-semibold text-ink">
      <span>{text}</span>
      <a href={other} className="underline underline-offset-4">
        {otherLabel}
      </a>
    </p>
  );
}
