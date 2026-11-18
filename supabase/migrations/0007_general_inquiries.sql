-- ============================================================================
-- OurWay — two publication types: Scheduled Excursion / General Experience
-- Applied after 0001–0006. Safe to re-run. Keeps every existing record.
--
-- excursions.booking_mode keeps its values:
--   departures → «Προγραμματισμένη Εκδρομή» (date-based participation request)
--   interest   → «Γενική Εμπειρία» (inquiry, no dates, no capacity)
--   none       → legacy "information only"; no longer offered for new
--                publications, still allowed so older rows stay valid.
--
-- General-experience inquiries stay in public.bookings (kind = 'interest'),
-- which already keeps them apart from scheduled requests (no departure, no
-- capacity hold, never counted by departure_held()). They now get their own
-- statuses and an optional "preferred date or period":
--   scheduled requests (kind = 'booking'):  pending, confirmed, rejected, cancelled, completed
--   inquiries          (kind = 'interest'): new, contacted, in_progress, closed
--
-- When written (18 Nov 2026) production had no booking rows, so nothing is
-- remapped there; the mapping below only matters for other environments.
--
-- Apply BEFORE deploying the code that sends "preferredPeriod".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- New field: preferred date / period for inquiries
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists preferred_period text;

do $$ begin
  alter table public.bookings add constraint bookings_preferred_period_len
    check (char_length(preferred_period) <= 200);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Statuses per kind
-- ---------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_status_by_kind;
-- The original single status list (named bookings_status_check by default):
-- drop whichever check constraint lists the statuses, whatever its name.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.bookings'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
      and pg_get_constraintdef(oid) like '%pending%'
  loop
    execute format('alter table public.bookings drop constraint %I', c);
  end loop;
end $$;

-- Older inquiries used the booking statuses: map them (and their history).
update public.request_status_history h
set from_status = case h.from_status
      when 'pending' then 'new' when 'confirmed' then 'in_progress'
      when 'rejected' then 'closed' when 'cancelled' then 'closed' when 'completed' then 'closed'
      else h.from_status end,
    to_status = case h.to_status
      when 'pending' then 'new' when 'confirmed' then 'in_progress'
      when 'rejected' then 'closed' when 'cancelled' then 'closed' when 'completed' then 'closed'
      else h.to_status end
from public.bookings b
where h.booking_id = b.id and b.kind = 'interest'
  and (h.from_status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')
       or h.to_status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed'));

update public.bookings
set status = case status
  when 'pending' then 'new' when 'confirmed' then 'in_progress' else 'closed' end
where kind = 'interest' and status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed');

alter table public.bookings alter column status drop default;

alter table public.bookings add constraint bookings_status_by_kind check (
  (kind = 'booking'  and status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed'))
  or (kind = 'interest' and status in ('new', 'contacted', 'in_progress', 'closed'))
);

-- ---------------------------------------------------------------------------
-- Public submission (replaces the 0003 version; same signature, same grants:
-- since 0005 only the website's server — service_role — may call it).
-- ---------------------------------------------------------------------------
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
  v_status     text;
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
    -- Scheduled excursion: participation request for one departure.
    v_kind := 'booking';
    v_status := 'pending';
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
    -- General experience: inquiry. No departure, no capacity, no hold.
    v_kind := 'interest';
    v_status := 'new';
    v_dep_id := null;
    v_price := null;
    v_hold := null;
  end if;

  -- Accidental duplicates: same person, same departure/experience, still open, last 30 minutes.
  if exists (
    select 1 from public.bookings b
    where lower(b.email) = v_email
      and b.excursion_id = v_ex.id
      and b.departure_id is not distinct from v_dep.id
      and b.status in ('pending', 'confirmed', 'new', 'contacted', 'in_progress')
      and b.created_at > now() - interval '30 minutes'
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;

  for attempt in 1..5 loop
    v_ref := public.new_reference('OW');
    begin
      insert into public.bookings (
        reference, kind, status, excursion_id, departure_id, first_name, last_name, email, phone,
        participants, message, special_requests, preferred_period, locale, unit_price_eur, total_eur,
        hold_expires_at, consent_at, idempotency_key, notify_token_hash
      ) values (
        v_ref, v_kind, v_status, v_ex.id, v_dep.id,
        btrim(p->>'first_name'), btrim(p->>'last_name'), v_email, btrim(p->>'phone'),
        v_people, nullif(btrim(p->>'message'), ''), nullif(btrim(p->>'special_requests'), ''),
        case when v_kind = 'interest' then nullif(btrim(p->>'preferred_period'), '') end,
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
        if attempt = 5 then raise; end if;
      when check_violation or not_null_violation then
        raise exception 'invalid' using errcode = 'P0001';
    end;
  end loop;

  insert into public.request_status_history (booking_id, from_status, to_status, note)
  values (v_id, null, v_status, 'Submitted on the website');

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
revoke execute on function public.submit_booking_request(jsonb) from public, anon, authenticated;
grant execute on function public.submit_booking_request(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Admin: scheduled requests only (inquiries have their own statuses)
-- ---------------------------------------------------------------------------
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
  if v_b.kind <> 'booking' then
    raise exception 'transition:%->%', v_b.status, p_status using errcode = 'P0001';
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
revoke all on function public.admin_set_booking_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_booking_status(uuid, text, text) to authenticated;

-- Admin: change a general-experience inquiry's status (any of the four; recorded in history).
create or replace function public.admin_set_inquiry_status(p_booking_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('new', 'contacted', 'in_progress', 'closed') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found or v_b.kind <> 'interest' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_b.status = p_status then
    return;
  end if;
  update public.bookings set status = p_status, status_changed_at = now() where id = p_booking_id;
  insert into public.request_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, v_b.status, p_status, nullif(btrim(p_note), ''), auth.uid());
end;
$$;
revoke all on function public.admin_set_inquiry_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_inquiry_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin list view: add preferred_period (appended, so existing columns keep their order)
-- ---------------------------------------------------------------------------
create or replace view public.booking_overview with (security_invoker = true) as
select
  b.id, b.reference, b.kind, b.status, b.excursion_id, b.departure_id,
  b.first_name, b.last_name, b.first_name || ' ' || b.last_name as full_name,
  b.email, b.phone, b.participants, b.unit_price_eur, b.total_eur, b.locale,
  b.hold_expires_at, b.status_changed_at, b.created_at,
  d.departure_date, d.departure_time,
  e.title_el as excursion_title_el, e.title_en as excursion_title_en, e.slug as excursion_slug, e.kind as excursion_kind,
  b.preferred_period
from public.bookings b
join public.excursions e on e.id = b.excursion_id
left join public.departures d on d.id = b.departure_id;

revoke all on public.booking_overview from anon;
grant select on public.booking_overview to authenticated;
