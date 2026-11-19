-- ---------------------------------------------------------------------------
-- 0011 — Requests are linked to their excursion and run at database level.
-- Applied after 0001–0010. Safe to re-run. Keeps every existing record.
--
-- public.bookings already stores real foreign keys:
--   excursion_id → excursions.id  (always)
--   departure_id → departures.id  (the chosen run; null for interest requests)
-- What was missing is a guarantee that the two agree: nothing in the schema
-- stopped a request from pointing at excursion A and a run of excursion B.
-- A composite foreign key (departure_id, excursion_id) → departures(id,
-- excursion_id) now makes that impossible. Rows with no run are unaffected
-- (MATCH SIMPLE skips the check when departure_id is null).
--
-- The admin list view also gets the run's end date and status and the
-- customer's message, so requests can be shown per excursion and per run
-- without opening them.
-- ---------------------------------------------------------------------------

-- Target of the composite key (id is already unique; this pairs it with its excursion).
do $$ begin
  alter table public.departures add constraint departures_id_excursion_key unique (id, excursion_id);
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.bookings
    add constraint bookings_departure_same_excursion
    foreign key (departure_id, excursion_id)
    references public.departures (id, excursion_id)
    on delete restrict
    not valid;
exception when duplicate_object then null; end $$;

-- Checks every existing row; fails loudly if any request is linked to a run of another excursion.
alter table public.bookings validate constraint bookings_departure_same_excursion;

create index if not exists bookings_excursion_departure_idx
  on public.bookings (excursion_id, departure_id, created_at desc);

-- Admin list view: new columns appended so existing columns keep their order.
create or replace view public.booking_overview with (security_invoker = true) as
select
  b.id, b.reference, b.kind, b.status, b.excursion_id, b.departure_id,
  b.first_name, b.last_name, b.first_name || ' ' || b.last_name as full_name,
  b.email, b.phone, b.participants, b.unit_price_eur, b.total_eur, b.locale,
  b.hold_expires_at, b.status_changed_at, b.created_at,
  d.departure_date, d.departure_time,
  e.title_el as excursion_title_el, e.title_en as excursion_title_en, e.slug as excursion_slug, e.kind as excursion_kind,
  b.preferred_period,
  d.return_date, d.status as departure_status,
  b.message, b.special_requests
from public.bookings b
join public.excursions e on e.id = b.excursion_id
left join public.departures d on d.id = b.departure_id;

revoke all on public.booking_overview from anon;
grant select on public.booking_overview to authenticated;
