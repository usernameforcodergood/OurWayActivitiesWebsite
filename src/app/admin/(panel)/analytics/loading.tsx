import { A } from "../../_lib/analytics-strings";

/** Skeleton while the period's aggregates are computed. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">{A.loading}</p>
      <div className="mb-8 h-9 w-72 animate-pulse rounded-lg bg-ink/10" />
      <div className="admin-card mb-6 h-24 animate-pulse" />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="admin-card h-36 animate-pulse" />
        ))}
      </ul>
      <div className="admin-card mt-6 h-80 animate-pulse" />
    </div>
  );
}
