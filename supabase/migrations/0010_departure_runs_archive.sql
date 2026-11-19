-- ---------------------------------------------------------------------------
-- 0010 — Reusable excursions: per-run end date + deposit, automatic archiving.
--
-- Data model (unchanged, documented here):
--   excursions  = reusable content (title, description, programme, photos,
--                 inclusions, destination info). Written once, reused.
--   departures  = one scheduled run of an excursion ("repeat" = a new row):
--                 its own dates, times, price, deposit, places, deadline, status.
--   bookings    = requests/participations; each belongs to one departure
--                 (departure_id), so every run keeps its own requests.
--
-- This migration is additive and re-runnable:
--   * departures.return_date  — end date of a multi-day run (null = same day);
--   * departures.deposit_eur  — deposit per person for this run
--                               (null = use the excursion's deposit);
--   * archive_started_departures() marks runs whose start date has arrived
--     (Europe/Athens) as 'completed'. Nothing is ever deleted: requests,
--     participations and amounts stay attached to the run;
--   * a pg_cron job runs it every 15 minutes, so it works even when nobody
--     visits the website. The public queries also filter by date, so a run
--     disappears from the public list on its start date even between runs.
-- ---------------------------------------------------------------------------

alter table public.departures
  add column if not exists return_date date,
  add column if not exists deposit_eur numeric(10, 2);

alter table public.departures drop constraint if exists departures_return_after_start;
alter table public.departures
  add constraint departures_return_after_start
  check (return_date is null or return_date >= departure_date);

-- Own deposit never negative, never above the run's own price (when set).
-- Against the excursion's base price it is checked by the admin Server Actions.
alter table public.departures drop constraint if exists departures_deposit_valid;
alter table public.departures
  add constraint departures_deposit_valid check (
    deposit_eur is null
    or (deposit_eur >= 0 and deposit_eur <= 1000000 and (price_eur is null or deposit_eur <= price_eur))
  );

comment on column public.departures.return_date is 'Last day of a multi-day run. Null = single-day run.';
comment on column public.departures.deposit_eur is
  'Deposit per person for this run (informational, no online payment). Null = the excursion''s deposit_eur.';

create index if not exists departures_status_date_idx on public.departures (status, departure_date);

-- ---------------------------------------------------------------------------
-- Automatic archiving
-- ---------------------------------------------------------------------------
create or replace function public.archive_started_departures()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.departures
  set status = 'completed'
  where status in ('open', 'full')
    and departure_date <= (now() at time zone 'Europe/Athens')::date;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.archive_started_departures() from public, anon, authenticated;

-- New participation requests are refused once the run's start date has
-- arrived, even in the minutes before the job marks it completed.
create or replace function public.bookings_guard_started_departure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.departure_id is not null and exists (
    select 1 from public.departures d
    where d.id = new.departure_id
      and d.departure_date <= (now() at time zone 'Europe/Athens')::date
  ) then
    raise exception 'departure_closed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_guard_started_departure on public.bookings;
create trigger bookings_guard_started_departure before insert on public.bookings
  for each row execute function public.bookings_guard_started_departure();

-- Archive what is already due right now.
select public.archive_started_departures();

-- Scheduled job (Supabase: Integrations → Cron). Re-running replaces the job.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule(
  'ourway-archive-started-departures',
  '*/15 * * * *',
  $cron$select public.archive_started_departures()$cron$
);

-- ---------------------------------------------------------------------------
-- Public availability: hide runs whose start date has arrived, expose the new
-- per-run fields. The return type changes, so the function is recreated.
-- ---------------------------------------------------------------------------
drop function if exists public.public_departures(uuid);
create function public.public_departures(p_excursion_id uuid)
returns table (
  id uuid,
  departure_date date,
  departure_time time,
  return_time time,
  price_eur numeric,
  capacity integer,
  min_participants integer,
  remaining integer,
  booking_deadline timestamptz,
  state text,
  note_el text,
  note_en text,
  return_date date,
  deposit_eur numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id, d.departure_date, d.departure_time, d.return_time,
    coalesce(d.price_eur, e.price_eur),
    d.capacity, d.min_participants,
    case when d.capacity is null then null
         else greatest(d.capacity - public.departure_held(d.id), 0) end,
    d.booking_deadline,
    case
      when d.status in ('cancelled', 'completed') then d.status
      when public.departure_starts_at(d.departure_date, d.departure_time) <= now() then 'past'
      when d.booking_deadline is not null and d.booking_deadline <= now() then 'closed'
      when d.status = 'full' then 'full'
      when d.capacity is not null and d.capacity - public.departure_held(d.id) <= 0 then 'full'
      else 'open'
    end,
    d.note_el, d.note_en,
    d.return_date,
    coalesce(d.deposit_eur, e.deposit_eur)
  from public.departures d
  join public.excursions e on e.id = d.excursion_id
  where d.excursion_id = p_excursion_id
    and e.status = 'published'
    and d.status <> 'completed'
    and d.departure_date > (now() at time zone 'Europe/Athens')::date
  order by d.departure_date, d.departure_time nulls first;
$$;
revoke all on function public.public_departures(uuid) from public;
grant execute on function public.public_departures(uuid) to anon, authenticated;
