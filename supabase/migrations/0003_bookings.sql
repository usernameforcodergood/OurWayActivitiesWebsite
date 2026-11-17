-- ============================================================================
-- OurWay — departures, booking requests, private group requests
-- Applied by `npm run db:setup` after 0001 and 0002. Safe to re-run.
--
-- Business rules enforced here (not in the website code):
--   * No payments. Prices are informational snapshots only.
--   * Every public submission starts as "pending" / "new". Only an admin can
--     confirm, and only through admin_set_booking_status().
--   * Capacity is checked inside one transaction while the departure row is
--     locked (SELECT … FOR UPDATE), so simultaneous requests cannot overbook.
--   * Held capacity = confirmed participants + pending participants whose hold
--     has not expired. Rejected / cancelled / expired holds release places.
--   * Visitors can never read bookings or personal data: they can only call
--     the submit_* functions, which return the new reference and nothing else.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Excursions: kind, booking mode, extra optional content
-- ---------------------------------------------------------------------------
alter table public.excursions
  add column if not exists kind                   text not null default 'excursion',
  add column if not exists booking_mode           text not null default 'departures',
  add column if not exists meeting_point_el       text,
  add column if not exists meeting_point_en       text,
  add column if not exists included_el            text,
  add column if not exists included_en            text,
  add column if not exists cancellation_policy_el text,
  add column if not exists cancellation_policy_en text;

do $$ begin
  alter table public.excursions add constraint excursions_kind_check check (kind in ('excursion', 'event'));
exception when duplicate_object then null; end $$;
do $$ begin
  -- departures: date-based reservation requests
  -- interest:   expression-of-interest form, no dates
  -- none:       information only, no form
  alter table public.excursions add constraint excursions_booking_mode_check
    check (booking_mode in ('departures', 'interest', 'none'));
exception when duplicate_object then null; end $$;

create index if not exists excursions_kind_idx on public.excursions (kind, status);

-- ---------------------------------------------------------------------------
-- Departures (scheduled dates of an excursion)
-- ---------------------------------------------------------------------------
create table if not exists public.departures (
  id               uuid primary key default gen_random_uuid(),
  excursion_id     uuid not null references public.excursions (id) on delete cascade,
  departure_date   date not null,
  departure_time   time,
  return_time      time,
  price_eur        numeric(10, 2) check (price_eur >= 0 and price_eur <= 1000000),
  capacity         integer check (capacity between 1 and 10000),        -- null = no limit
  min_participants integer check (min_participants between 1 and 10000),
  booking_deadline timestamptz,                                          -- null = until departure
  status           text not null default 'open'
                   check (status in ('open', 'full', 'cancelled', 'completed')),
  note_el          text check (char_length(note_el) <= 400),
  note_en          text check (char_length(note_en) <= 400),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint departures_min_le_capacity
    check (min_participants is null or capacity is null or min_participants <= capacity),
  constraint departures_unique_slot unique nulls not distinct (excursion_id, departure_date, departure_time)
);

create index if not exists departures_excursion_idx on public.departures (excursion_id, departure_date);
create index if not exists departures_date_idx on public.departures (departure_date);

drop trigger if exists departures_touch on public.departures;
create trigger departures_touch before update on public.departures
  for each row execute function public.touch_updated_at();

-- One-time copy of the old free-form date list into real departures (only for
-- excursions that have no departures yet, so re-running adds nothing).
-- available_dates is left untouched so a site still running the previous
-- code keeps showing its dates until the new version is deployed.
insert into public.departures (excursion_id, departure_date, price_eur)
select e.id, d.day, e.price_eur
from public.excursions e
cross join lateral unnest(e.available_dates) as d(day)
where cardinality(e.available_dates) > 0
  and not exists (select 1 from public.departures x where x.excursion_id = e.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Booking requests
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique check (reference ~ '^OW-[A-Z0-9]{6}$'),
  kind               text not null check (kind in ('booking', 'interest')),
  excursion_id       uuid not null references public.excursions (id) on delete restrict,
  departure_id       uuid references public.departures (id) on delete restrict,
  status             text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),

  first_name         text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name          text not null check (char_length(btrim(last_name)) between 1 and 80),
  email              text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone              text not null check (phone ~ '^[+()0-9 .-]{6,40}$'),
  participants       integer not null check (participants between 1 and 100),
  message            text check (char_length(message) <= 3000),
  special_requests   text check (char_length(special_requests) <= 2000),
  locale             text not null default 'el' check (locale in ('el', 'en')),

  -- Informational price snapshot at submission time. Never a payment.
  unit_price_eur     numeric(10, 2) check (unit_price_eur >= 0),
  total_eur          numeric(12, 2) check (total_eur >= 0),

  -- Pending requests hold places until this moment (see hold policy).
  hold_expires_at    timestamptz,
  consent_at         timestamptz not null,
  idempotency_key    uuid not null unique,
  notify_token_hash  bytea,
  status_changed_at  timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint bookings_departure_matches_kind
    check ((kind = 'booking') = (departure_id is not null))
);

create index if not exists bookings_status_idx on public.bookings (status, created_at desc);
create index if not exists bookings_departure_idx on public.bookings (departure_id, status);
create index if not exists bookings_excursion_idx on public.bookings (excursion_id, created_at desc);
create index if not exists bookings_email_idx on public.bookings (lower(email), created_at desc);

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Private group trip requests ("Design your own excursion")
-- ---------------------------------------------------------------------------
create table if not exists public.private_requests (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique check (reference ~ '^PG-[A-Z0-9]{6}$'),
  status               text not null default 'new'
                       check (status in ('new', 'contacted', 'planning', 'proposal_sent', 'accepted', 'rejected', 'completed')),

  first_name           text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name            text not null check (char_length(btrim(last_name)) between 1 and 80),
  email                text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                text not null check (phone ~ '^[+()0-9 .-]{6,40}$'),
  participants         integer not null check (participants between 1 and 500),

  destination          text check (char_length(destination) <= 300),
  destination_flexible boolean not null default false,
  excursion_type       text check (char_length(excursion_type) <= 200),
  date_from            date,
  date_to              date,
  dates_flexible       boolean not null default false,
  duration             text check (char_length(duration) <= 120),
  difficulty           text check (char_length(difficulty) <= 120),
  transport            text check (char_length(transport) <= 500),
  activities           text check (char_length(activities) <= 2000),
  budget_per_person    text check (char_length(budget_per_person) <= 120),
  message              text check (char_length(message) <= 3000),
  locale               text not null default 'el' check (locale in ('el', 'en')),

  -- Internal planning (admins only, never shown to the customer).
  proposal_itinerary   text,
  proposal_dates       text,
  proposal_price_eur   numeric(10, 2) check (proposal_price_eur >= 0),

  consent_at           timestamptz not null,
  idempotency_key      uuid not null unique,
  notify_token_hash    bytea,
  status_changed_at    timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint private_requests_dates_order check (date_to is null or date_from is null or date_to >= date_from)
);

create index if not exists private_requests_status_idx on public.private_requests (status, created_at desc);

drop trigger if exists private_requests_touch on public.private_requests;
create trigger private_requests_touch before update on public.private_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Status history, internal notes, email delivery log
-- Each row belongs to exactly one booking or one private request.
-- ---------------------------------------------------------------------------
create table if not exists public.request_status_history (
  id                 bigint generated always as identity primary key,
  booking_id         uuid references public.bookings (id) on delete cascade,
  private_request_id uuid references public.private_requests (id) on delete cascade,
  from_status        text,
  to_status          text not null,
  note               text check (char_length(note) <= 2000),
  changed_by         uuid references auth.users (id) on delete set null,  -- null = customer / system
  created_at         timestamptz not null default now(),
  constraint request_status_history_one_parent check (num_nonnulls(booking_id, private_request_id) = 1)
);
create index if not exists request_status_history_booking_idx on public.request_status_history (booking_id, created_at);
create index if not exists request_status_history_private_idx on public.request_status_history (private_request_id, created_at);

create table if not exists public.request_notes (
  id                 bigint generated always as identity primary key,
  booking_id         uuid references public.bookings (id) on delete cascade,
  private_request_id uuid references public.private_requests (id) on delete cascade,
  body               text not null check (char_length(btrim(body)) between 1 and 4000),
  author_id          uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint request_notes_one_parent check (num_nonnulls(booking_id, private_request_id) = 1)
);
create index if not exists request_notes_booking_idx on public.request_notes (booking_id, created_at);
create index if not exists request_notes_private_idx on public.request_notes (private_request_id, created_at);

create table if not exists public.email_notifications (
  id                 bigint generated always as identity primary key,
  booking_id         uuid references public.bookings (id) on delete cascade,
  private_request_id uuid references public.private_requests (id) on delete cascade,
  kind               text not null check (kind in (
                       'admin_new_booking', 'booking_received', 'booking_confirmed',
                       'booking_rejected', 'booking_cancelled',
                       'admin_new_private', 'private_received')),
  recipient          text not null check (char_length(recipient) <= 200),
  status             text not null check (status in ('sent', 'failed', 'not_configured')),
  error              text check (char_length(error) <= 500),
  created_at         timestamptz not null default now(),
  constraint email_notifications_one_parent check (num_nonnulls(booking_id, private_request_id) = 1)
);
create index if not exists email_notifications_booking_idx on public.email_notifications (booking_id, created_at);
create index if not exists email_notifications_private_idx on public.email_notifications (private_request_id, created_at);
create index if not exists email_notifications_failed_idx on public.email_notifications (created_at desc) where status <> 'sent';

-- ============================================================================
-- Capacity helpers
-- ============================================================================

-- Pending requests hold their places for this long (never past the departure).
create or replace function public.booking_hold_interval()
returns interval language sql immutable set search_path = '' as $$ select interval '72 hours' $$;

-- Participants currently occupying places on a departure. `p_exclude` lets a
-- confirmation re-check capacity without counting the same booking twice.
create or replace function public.departure_held(p_departure_id uuid, p_exclude uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(b.participants), 0)::integer
  from public.bookings b
  where b.departure_id = p_departure_id
    and (p_exclude is null or b.id <> p_exclude)
    and (
      b.status = 'confirmed'
      or (b.status = 'pending' and b.hold_expires_at > now())
    );
$$;
revoke all on function public.departure_held(uuid, uuid) from public, anon, authenticated;

-- Athens-local timestamp of a departure (time defaults to start of day).
create or replace function public.departure_starts_at(p_date date, p_time time)
returns timestamptz language sql immutable set search_path = '' as $$
  select (p_date + coalesce(p_time, time '00:00')) at time zone 'Europe/Athens'
$$;

-- Admins may not shrink capacity below places already held.
create or replace function public.departures_guard_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  held integer;
begin
  if new.capacity is not null and (tg_op = 'INSERT' or new.capacity is distinct from old.capacity) then
    held := public.departure_held(new.id);
    if new.capacity < held then
      raise exception 'capacity_below_held:%', held using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists departures_guard_capacity on public.departures;
create trigger departures_guard_capacity before insert or update on public.departures
  for each row execute function public.departures_guard_capacity();

-- Public availability of the bookable departures of one published excursion.
-- Returns only counts, never personal data.
create or replace function public.public_departures(p_excursion_id uuid)
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
  note_en text
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
    d.note_el, d.note_en
  from public.departures d
  join public.excursions e on e.id = d.excursion_id
  where d.excursion_id = p_excursion_id
    and e.status = 'published'
    and d.departure_date >= (now() at time zone 'Europe/Athens')::date
  order by d.departure_date, d.departure_time nulls first;
$$;
revoke all on function public.public_departures(uuid) from public;
grant execute on function public.public_departures(uuid) to anon, authenticated;

-- ============================================================================
-- Reference + token helpers
-- ============================================================================
create or replace function public.new_reference(p_prefix text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I
  bytes bytea := extensions.gen_random_bytes(6);
  out text := p_prefix || '-';
begin
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end;
$$;
revoke all on function public.new_reference(text) from public, anon, authenticated;

-- ============================================================================
-- Public submission: booking request / expression of interest
-- ============================================================================
create or replace function public.submit_booking_request(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key        uuid;
  v_existing   public.bookings%rowtype;
  v_ex         public.excursions%rowtype;
  v_dep        public.departures%rowtype;
  v_kind       text;
  v_people     integer;
  v_email      text := lower(btrim(coalesce(p->>'email', '')));
  v_price      numeric;
  v_held       integer;
  v_hold       timestamptz;
  v_token      text := encode(extensions.gen_random_bytes(24), 'hex');
  v_ref        text;
  v_id         uuid;
  v_starts     timestamptz;
  v_ex_id      uuid;
  v_dep_id     uuid;
begin
  begin
    v_key := (p->>'idempotency_key')::uuid;
    v_people := (p->>'participants')::integer;
    v_ex_id := (p->>'excursion_id')::uuid;
    v_dep_id := nullif(p->>'departure_id', '')::uuid;
  exception when others then
    raise exception 'invalid' using errcode = 'P0001';
  end;
  if v_key is null or v_people is null or v_people < 1 or v_people > 100 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'consent' using errcode = 'P0001';
  end if;

  -- Same form submitted twice (double click, retry): return the first result.
  select * into v_existing from public.bookings where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'replayed', true,
      'email_sent', exists (select 1 from public.email_notifications n where n.booking_id = v_existing.id and n.kind = 'booking_received' and n.status = 'sent'));
  end if;

  select * into v_ex from public.excursions
  where id = v_ex_id and status = 'published';
  if not found or v_ex.booking_mode = 'none' then
    raise exception 'unavailable' using errcode = 'P0001';
  end if;

  if v_ex.booking_mode = 'departures' then
    v_kind := 'booking';
    if v_dep_id is null then
      raise exception 'departure_required' using errcode = 'P0001';
    end if;
    -- Lock the departure: concurrent requests for it queue up here.
    select * into v_dep from public.departures
    where id = v_dep_id and excursion_id = v_ex.id
    for update;
    if not found then
      raise exception 'unavailable' using errcode = 'P0001';
    end if;
    v_starts := public.departure_starts_at(v_dep.departure_date, v_dep.departure_time);
    if v_dep.status in ('cancelled', 'completed') or v_starts <= now() then
      raise exception 'departure_closed' using errcode = 'P0001';
    end if;
    if v_dep.booking_deadline is not null and v_dep.booking_deadline <= now() then
      raise exception 'deadline_passed' using errcode = 'P0001';
    end if;
    if v_dep.status = 'full' then
      raise exception 'full' using errcode = 'P0001';
    end if;
    if v_dep.capacity is not null then
      v_held := public.departure_held(v_dep.id);
      if v_held >= v_dep.capacity then
        raise exception 'full' using errcode = 'P0001';
      end if;
      if v_held + v_people > v_dep.capacity then
        raise exception 'capacity:%', v_dep.capacity - v_held using errcode = 'P0001';
      end if;
    end if;
    v_price := coalesce(v_dep.price_eur, v_ex.price_eur);
    v_hold := least(now() + public.booking_hold_interval(), v_starts);
  else
    v_kind := 'interest';
    v_price := null;
    v_hold := null;
  end if;

  -- Accidental duplicates: same person, same departure/event, still active, last 30 minutes.
  if exists (
    select 1 from public.bookings b
    where lower(b.email) = v_email
      and b.excursion_id = v_ex.id
      and b.departure_id is not distinct from v_dep.id
      and b.status in ('pending', 'confirmed')
      and b.created_at > now() - interval '30 minutes'
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;

  for attempt in 1..5 loop
    v_ref := public.new_reference('OW');
    begin
      insert into public.bookings (
        reference, kind, excursion_id, departure_id, first_name, last_name, email, phone,
        participants, message, special_requests, locale, unit_price_eur, total_eur,
        hold_expires_at, consent_at, idempotency_key, notify_token_hash
      ) values (
        v_ref, v_kind, v_ex.id, v_dep.id,
        btrim(p->>'first_name'), btrim(p->>'last_name'), v_email, btrim(p->>'phone'),
        v_people, nullif(btrim(p->>'message'), ''), nullif(btrim(p->>'special_requests'), ''),
        coalesce(nullif(p->>'locale', ''), 'el'),
        v_price, case when v_price is null then null else v_price * v_people end,
        v_hold, now(), v_key, extensions.digest(v_token, 'sha256')
      ) returning id into v_id;
      exit;
    exception
      when unique_violation then
        -- Lost a race on the idempotency key: return the winner's row.
        select * into v_existing from public.bookings where idempotency_key = v_key;
        if found then
          return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'replayed', true,
            'email_sent', exists (select 1 from public.email_notifications n where n.booking_id = v_existing.id and n.kind = 'booking_received' and n.status = 'sent'));
        end if;
        if attempt = 5 then raise; end if;   -- reference collision 5 times in a row
      when check_violation or not_null_violation then
        raise exception 'invalid' using errcode = 'P0001';
    end;
  end loop;

  insert into public.request_status_history (booking_id, from_status, to_status, note)
  values (v_id, null, 'pending', 'Submitted on the website');

  return jsonb_build_object(
    'id', v_id,
    'reference', v_ref,
    'replayed', false,
    'notify_token', v_token,
    'kind', v_kind,
    'unit_price_eur', v_price,
    'total_eur', case when v_price is null then null else v_price * v_people end,
    'hold_expires_at', v_hold
  );
end;
$$;
revoke all on function public.submit_booking_request(jsonb) from public;
grant execute on function public.submit_booking_request(jsonb) to anon, authenticated;

-- ============================================================================
-- Public submission: private group request
-- ============================================================================
create or replace function public.submit_private_request(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key    uuid;
  v_people integer;
  v_email  text := lower(btrim(coalesce(p->>'email', '')));
  v_token  text := encode(extensions.gen_random_bytes(24), 'hex');
  v_ref    text;
  v_id     uuid;
  v_existing public.private_requests%rowtype;
begin
  begin
    v_key := (p->>'idempotency_key')::uuid;
    v_people := (p->>'participants')::integer;
  exception when others then
    raise exception 'invalid' using errcode = 'P0001';
  end;
  if v_key is null or v_people is null or v_people < 1 or v_people > 500 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'consent' using errcode = 'P0001';
  end if;

  select * into v_existing from public.private_requests where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'replayed', true,
      'email_sent', exists (select 1 from public.email_notifications n where n.private_request_id = v_existing.id and n.kind = 'private_received' and n.status = 'sent'));
  end if;

  if exists (
    select 1 from public.private_requests r
    where lower(r.email) = v_email and r.created_at > now() - interval '30 minutes'
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;

  for attempt in 1..5 loop
    v_ref := public.new_reference('PG');
    begin
      insert into public.private_requests (
        reference, first_name, last_name, email, phone, participants,
        destination, destination_flexible, excursion_type, date_from, date_to, dates_flexible,
        duration, difficulty, transport, activities, budget_per_person, message, locale,
        consent_at, idempotency_key, notify_token_hash
      ) values (
        v_ref, btrim(p->>'first_name'), btrim(p->>'last_name'), v_email, btrim(p->>'phone'), v_people,
        nullif(btrim(p->>'destination'), ''), coalesce((p->>'destination_flexible')::boolean, false),
        nullif(btrim(p->>'excursion_type'), ''),
        nullif(p->>'date_from', '')::date, nullif(p->>'date_to', '')::date,
        coalesce((p->>'dates_flexible')::boolean, false),
        nullif(btrim(p->>'duration'), ''), nullif(btrim(p->>'difficulty'), ''),
        nullif(btrim(p->>'transport'), ''), nullif(btrim(p->>'activities'), ''),
        nullif(btrim(p->>'budget_per_person'), ''), nullif(btrim(p->>'message'), ''),
        coalesce(nullif(p->>'locale', ''), 'el'),
        now(), v_key, extensions.digest(v_token, 'sha256')
      ) returning id into v_id;
      exit;
    exception
      when unique_violation then
        select * into v_existing from public.private_requests where idempotency_key = v_key;
        if found then
          return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'replayed', true,
            'email_sent', exists (select 1 from public.email_notifications n where n.private_request_id = v_existing.id and n.kind = 'private_received' and n.status = 'sent'));
        end if;
        if attempt = 5 then raise; end if;
      when check_violation or not_null_violation or invalid_datetime_format or datetime_field_overflow then
        raise exception 'invalid' using errcode = 'P0001';
    end;
  end loop;

  insert into public.request_status_history (private_request_id, from_status, to_status, note)
  values (v_id, null, 'new', 'Submitted on the website');

  return jsonb_build_object('id', v_id, 'reference', v_ref, 'replayed', false, 'notify_token', v_token);
end;
$$;
revoke all on function public.submit_private_request(jsonb) from public;
grant execute on function public.submit_private_request(jsonb) to anon, authenticated;

-- ============================================================================
-- Email log written by the server right after a public submission.
-- Only the caller holding the one-time token returned by submit_* may write,
-- only for that request, only within 15 minutes and once per email kind.
-- ============================================================================
create or replace function public.record_submission_email(
  p_reference text, p_token text, p_kind text, p_recipient text, p_status text, p_error text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hash bytea := extensions.digest(coalesce(p_token, ''), 'sha256');
  v_booking uuid;
  v_private uuid;
begin
  if p_kind in ('admin_new_booking', 'booking_received') then
    select id into v_booking from public.bookings
    where reference = p_reference and notify_token_hash = v_hash and created_at > now() - interval '15 minutes';
  elsif p_kind in ('admin_new_private', 'private_received') then
    select id into v_private from public.private_requests
    where reference = p_reference and notify_token_hash = v_hash and created_at > now() - interval '15 minutes';
  end if;
  if v_booking is null and v_private is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.email_notifications n
    where n.kind = p_kind and (n.booking_id = v_booking or n.private_request_id = v_private)
  ) then
    return;
  end if;
  insert into public.email_notifications (booking_id, private_request_id, kind, recipient, status, error)
  values (v_booking, v_private, p_kind, left(p_recipient, 200), p_status, left(p_error, 500));
end;
$$;
revoke all on function public.record_submission_email(text, text, text, text, text, text) from public;
grant execute on function public.record_submission_email(text, text, text, text, text, text) to anon, authenticated;

-- ============================================================================
-- Admin: change a booking's status (the only way a booking gets confirmed)
-- ============================================================================
create or replace function public.admin_set_booking_status(p_booking_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_b    public.bookings%rowtype;
  v_dep  public.departures%rowtype;
  v_held integer;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not (
       (v_b.status = 'pending'   and p_status in ('confirmed', 'rejected', 'cancelled'))
    or (v_b.status = 'confirmed' and p_status in ('cancelled', 'completed'))
  ) then
    raise exception 'transition:%->%', v_b.status, p_status using errcode = 'P0001';
  end if;

  if p_status = 'confirmed' and v_b.departure_id is not null then
    -- Same lock as public submissions, so a confirmation and a new request
    -- can never both take the last places.
    select * into v_dep from public.departures where id = v_b.departure_id for update;
    if v_dep.status = 'cancelled' then
      raise exception 'departure_cancelled' using errcode = 'P0001';
    end if;
    if v_dep.capacity is not null then
      -- Exclude this booking so its own (possibly expired) hold is counted once.
      v_held := public.departure_held(v_dep.id, v_b.id);
      if v_held + v_b.participants > v_dep.capacity then
        raise exception 'capacity:%', greatest(v_dep.capacity - v_held, 0) using errcode = 'P0001';
      end if;
    end if;
  end if;

  update public.bookings
  set status = p_status,
      status_changed_at = now(),
      hold_expires_at = case when p_status = 'pending' then hold_expires_at else null end
  where id = p_booking_id;

  insert into public.request_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, v_b.status, p_status, nullif(btrim(p_note), ''), auth.uid());

  return jsonb_build_object('id', p_booking_id, 'from', v_b.status, 'to', p_status);
end;
$$;
revoke all on function public.admin_set_booking_status(uuid, text, text) from public;
grant execute on function public.admin_set_booking_status(uuid, text, text) to authenticated;

-- Admin: give a pending request a fresh hold (re-checks capacity).
create or replace function public.admin_extend_booking_hold(p_booking_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_b    public.bookings%rowtype;
  v_dep  public.departures%rowtype;
  v_held integer;
  v_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v_b from public.bookings where id = p_booking_id;
  if not found or v_b.status <> 'pending' or v_b.departure_id is null then
    raise exception 'transition' using errcode = 'P0001';
  end if;
  select * into v_dep from public.departures where id = v_b.departure_id for update;
  if v_dep.capacity is not null then
    v_held := public.departure_held(v_dep.id, v_b.id);
    if v_held + v_b.participants > v_dep.capacity then
      raise exception 'capacity:%', greatest(v_dep.capacity - v_held, 0) using errcode = 'P0001';
    end if;
  end if;
  v_until := least(now() + public.booking_hold_interval(),
                   public.departure_starts_at(v_dep.departure_date, v_dep.departure_time));
  update public.bookings set hold_expires_at = v_until where id = p_booking_id;
  insert into public.request_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, 'pending', 'pending', 'Hold extended', auth.uid());
  return v_until;
end;
$$;
revoke all on function public.admin_extend_booking_hold(uuid) from public;
grant execute on function public.admin_extend_booking_hold(uuid) to authenticated;

-- Admin: change a private request's status (recorded in history).
create or replace function public.admin_set_private_request_status(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select status into v_from from public.private_requests where id = p_id for update;
  if v_from is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_from = p_status then
    return;
  end if;
  update public.private_requests set status = p_status, status_changed_at = now() where id = p_id;
  insert into public.request_status_history (private_request_id, from_status, to_status, note, changed_by)
  values (p_id, v_from, p_status, nullif(btrim(p_note), ''), auth.uid());
end;
$$;
revoke all on function public.admin_set_private_request_status(uuid, text, text) from public;
grant execute on function public.admin_set_private_request_status(uuid, text, text) to authenticated;

-- Admin dashboard: capacity numbers for many departures at once.
create or replace function public.admin_departure_stats(p_ids uuid[])
returns table (departure_id uuid, confirmed integer, pending_held integer, pending_expired integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select d.id,
    coalesce(sum(b.participants) filter (where b.status = 'confirmed'), 0)::integer,
    coalesce(sum(b.participants) filter (where b.status = 'pending' and b.hold_expires_at > now()), 0)::integer,
    coalesce(sum(b.participants) filter (where b.status = 'pending' and (b.hold_expires_at is null or b.hold_expires_at <= now())), 0)::integer
  from unnest(p_ids) as d(id)
  left join public.bookings b on b.departure_id = d.id
  group by d.id;
end;
$$;
revoke all on function public.admin_departure_stats(uuid[]) from public;
grant execute on function public.admin_departure_stats(uuid[]) to authenticated;

-- ============================================================================
-- Admin list view: bookings with their excursion and departure, so the
-- dashboard can search by full name and sort by departure date.
-- security_invoker: the caller's RLS applies, so only admins see rows.
-- ============================================================================
create or replace view public.booking_overview with (security_invoker = true) as
select
  b.id, b.reference, b.kind, b.status, b.excursion_id, b.departure_id,
  b.first_name, b.last_name, b.first_name || ' ' || b.last_name as full_name,
  b.email, b.phone, b.participants, b.unit_price_eur, b.total_eur, b.locale,
  b.hold_expires_at, b.status_changed_at, b.created_at,
  d.departure_date, d.departure_time,
  e.title_el as excursion_title_el, e.title_en as excursion_title_en, e.slug as excursion_slug, e.kind as excursion_kind
from public.bookings b
join public.excursions e on e.id = b.excursion_id
left join public.departures d on d.id = b.departure_id;

revoke all on public.booking_overview from anon;
grant select on public.booking_overview to authenticated;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.departures             enable row level security;
alter table public.bookings               enable row level security;
alter table public.private_requests       enable row level security;
alter table public.request_status_history enable row level security;
alter table public.request_notes          enable row level security;
alter table public.email_notifications    enable row level security;

-- departures: public may read those of published excursions; admins write.
drop policy if exists "departures read" on public.departures;
create policy "departures read" on public.departures for select
  using (
    (select public.is_admin())
    or exists (select 1 from public.excursions e where e.id = excursion_id and e.status = 'published')
  );
drop policy if exists "departures admin write" on public.departures;
create policy "departures admin write" on public.departures for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Personal data: admins only. No insert policies: rows are created only by
-- the security-definer submit_* functions; statuses change only through the
-- admin_* functions (which also write the history).
drop policy if exists "bookings admin read" on public.bookings;
create policy "bookings admin read" on public.bookings for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "private_requests admin read" on public.private_requests;
create policy "private_requests admin read" on public.private_requests for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "private_requests admin update" on public.private_requests;
create policy "private_requests admin update" on public.private_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Admins may edit only the internal proposal fields directly.
revoke update on public.private_requests from anon, authenticated;
grant update (proposal_itinerary, proposal_dates, proposal_price_eur) on public.private_requests to authenticated;

revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.request_status_history from anon, authenticated;

drop policy if exists "request_status_history admin read" on public.request_status_history;
create policy "request_status_history admin read" on public.request_status_history for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "request_notes admin read" on public.request_notes;
create policy "request_notes admin read" on public.request_notes for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "request_notes admin insert" on public.request_notes;
create policy "request_notes admin insert" on public.request_notes for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

drop policy if exists "email_notifications admin read" on public.email_notifications;
create policy "email_notifications admin read" on public.email_notifications for select to authenticated
  using ((select public.is_admin()));
drop policy if exists "email_notifications admin insert" on public.email_notifications;
create policy "email_notifications admin insert" on public.email_notifications for insert to authenticated
  with check ((select public.is_admin()));
revoke update, delete on public.email_notifications from anon, authenticated;
