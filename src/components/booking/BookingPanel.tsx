"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock, Users } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/dictionaries";
import type { PublicDeparture, PublicExcursion } from "@/lib/cms/types";
import { formatDateShort, formatDateTime, formatEur } from "@/lib/bookings/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { BookingDialog } from "./BookingDialog";

type Props = {
  excursion: Pick<PublicExcursion, "id" | "title" | "bookingMode" | "departures">;
  locale: Locale;
  t: Dictionary["booking"];
  privacyHref: string;
  contactHref: string;
  /** Admin preview: shows the real UI but never submits. */
  preview?: boolean;
};

type Load = { kind: "loading" } | { kind: "ready"; departures: PublicDeparture[] } | { kind: "error" };

/** Shown until live availability arrives (no counts yet, nothing selectable). */
function initialDepartures(ex: Props["excursion"]): PublicDeparture[] {
  return ex.departures
    .filter((d) => d.status === "open" || d.status === "full")
    .map((d) => ({
      id: d.id,
      date: d.date,
      time: d.time,
      returnTime: null,
      priceEur: d.priceEur,
      capacity: null,
      minParticipants: null,
      remaining: null,
      deadline: null,
      state: d.status === "full" ? "full" : "open",
      noteEl: null,
      noteEn: null,
    }));
}

export function BookingPanel({ excursion, locale, t, privacyHref, contactHref, preview }: Props) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [open, setOpen] = useState<{ departureId: string | null } | null>(null);
  const mode = excursion.bookingMode;

  const refresh = useCallback(async () => {
    if (mode !== "departures") return;
    try {
      const res = await fetch(`/api/availability/${excursion.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { departures: PublicDeparture[] };
      setLoad({ kind: "ready", departures: body.departures });
    } catch {
      setLoad({ kind: "error" });
    }
  }, [excursion.id, mode]);

  useEffect(() => {
    // Live counts are fetched after hydration; the page itself stays cached.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  if (mode === "none") {
    return (
      <div className="rounded-sm bg-forest p-8">
        <p className="text-display-sm">{t.infoTitle}</p>
        <p className="mt-3 text-fog">{t.infoBody}</p>
        <ButtonLink href={contactHref} className="mt-6">
          {t.infoCta}
        </ButtonLink>
      </div>
    );
  }

  if (mode === "interest") {
    return (
      <div className="rounded-sm bg-forest p-8">
        <p className="text-display-sm">{t.interestTitle}</p>
        <p className="mt-3 text-fog">{t.interestBody}</p>
        <Button type="button" className="mt-6" onClick={() => setOpen({ departureId: null })} aria-haspopup="dialog">
          {t.ctaInterest}
        </Button>
        <p className="mt-5 text-xs text-fog">{t.noPayment}</p>
        {open && (
          <BookingDialog
            mode="interest"
            excursion={excursion}
            departures={[]}
            initialDepartureId={null}
            locale={locale}
            t={t}
            privacyHref={privacyHref}
            preview={preview}
            onClose={() => setOpen(null)}
            onAvailabilityChanged={refresh}
          />
        )}
      </div>
    );
  }

  const departures = load.kind === "ready" ? load.departures : initialDepartures(excursion);
  const live = load.kind === "ready";
  const bookable = live ? departures.filter((d) => d.state === "open") : [];

  return (
    <div className="rounded-sm bg-forest p-8">
      <p className="text-display-sm">{t.bookTitle}</p>
      <p className="mt-3 text-fog">{t.bookBody}</p>

      <h3 className="text-eyebrow mb-3 mt-8 font-sans text-fog">{t.departuresTitle}</h3>
      {load.kind === "loading" && (
        <p role="status" className="mb-3 text-sm text-fog">
          {t.loading}
        </p>
      )}
      {load.kind === "error" && (
        <div role="alert" className="mb-3 text-sm text-sand">
          {t.availabilityError}{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => void refresh()}>
            {t.retry}
          </button>
        </div>
      )}

      {departures.length === 0 ? (
        live && (
          <div>
            <p className="text-fog">{t.noDepartures}</p>
            <ButtonLink href={contactHref} variant="outline" className="mt-6">
              {t.noDeparturesCta}
            </ButtonLink>
          </div>
        )
      ) : (
        <ul className="divide-y divide-bone/10 border-y border-bone/10" aria-busy={!live}>
          {departures.map((d) => {
            const isOpen = live && d.state === "open";
            const note = locale === "el" ? d.noteEl || d.noteEn : d.noteEn || d.noteEl;
            return (
              <li key={d.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      <CalendarDays aria-hidden className="size-4 shrink-0 text-lichen" />
                      <time dateTime={d.date}>{formatDateShort(d.date, locale)}</time>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-fog">
                      {d.time && (
                        <span className="inline-flex items-center gap-1">
                          <Clock aria-hidden className="size-3.5" />
                          {d.time.slice(0, 5)}
                          {d.returnTime && ` · ${format(t.returnAt, { time: d.returnTime.slice(0, 5) })}`}
                        </span>
                      )}
                      {d.priceEur != null && (
                        <span>
                          {formatEur(d.priceEur, locale)} {t.perPerson}
                        </span>
                      )}
                    </p>
                    {live && d.state === "open" && (
                      <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-fog">
                        {d.remaining != null && (
                          <span className="inline-flex items-center gap-1 text-lichen">
                            <Users aria-hidden className="size-3.5" />
                            {d.remaining === 1 ? t.remainingOne : format(t.remaining, { count: d.remaining })}
                          </span>
                        )}
                        {d.deadline && <span>{format(t.deadline, { date: formatDateTime(d.deadline, locale) })}</span>}
                        {d.minParticipants && <span>{format(t.minParticipants, { count: d.minParticipants })}</span>}
                      </p>
                    )}
                    {note && <p className="mt-1 text-xs text-fog">{note}</p>}
                  </div>
                  {isOpen ? (
                    <button
                      type="button"
                      onClick={() => setOpen({ departureId: d.id })}
                      aria-haspopup="dialog"
                      className="shrink-0 rounded-full border border-bone/30 px-4 py-2 text-sm font-semibold transition-colors hover:border-sand hover:bg-sand hover:text-ink"
                    >
                      {t.ctaBook}
                      <span className="sr-only"> — {formatDateShort(d.date, locale)}</span>
                    </button>
                  ) : (
                    live && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                          d.state === "full" ? "bg-clay/25 text-sand" : "bg-bone/10 text-fog",
                        )}
                      >
                        {t.states[d.state]}
                      </span>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {bookable.length > 0 && (
        <Button type="button" className="mt-6 w-full" onClick={() => setOpen({ departureId: bookable.length === 1 ? bookable[0].id : null })} aria-haspopup="dialog">
          {t.ctaRequest}
        </Button>
      )}
      <p className="mt-5 text-xs text-fog">{t.noPayment}</p>

      {open && (
        <BookingDialog
          mode="departures"
          excursion={excursion}
          departures={bookable}
          initialDepartureId={open.departureId}
          locale={locale}
          t={t}
          privacyHref={privacyHref}
          preview={preview}
          onClose={() => setOpen(null)}
          onAvailabilityChanged={refresh}
        />
      )}
    </div>
  );
}
