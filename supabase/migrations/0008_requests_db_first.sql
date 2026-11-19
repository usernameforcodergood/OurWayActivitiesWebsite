-- ============================================================================
-- OurWay — database-first requests (no visitor request depends on email)
-- Applied after 0001–0007. Safe to re-run. Keeps every existing record.
--
-- 1. A scheduled excursion with no open departure now accepts an interest
--    request (bookings.kind = 'interest', status 'new') instead of sending the
--    visitor to the email-only contact form. With a departure chosen, it is a
--    participation request exactly as before (capacity, hold, statuses).
-- 2. The contact form is saved in public.contact_messages (it used to exist
--    only as an email, so it was lost whenever email delivery was off).
--
-- Apply BEFORE deploying the code that uses submit_contact_message().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Scheduled excursion without a departure → interest request
--    (0007 body; only the branch condition changed: "and v_dep_id is not null")
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

  if v_ex.booking_mode = 'departures' and v_dep_id is not null then
    -- Scheduled excursion: participation request for one departure.
    v_kind := 'booking';
    v_status := 'pending';
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
    -- General experience, or a scheduled excursion with no departure chosen
    -- (none open yet): interest request. No departure, no capacity, no hold.
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
-- 2. Contact form messages
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  status           text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  name             text not null check (char_length(name) between 2 and 120),
  email            text not null check (char_length(email) between 3 and 200),
  phone            text check (char_length(phone) <= 40),
  interest         text check (char_length(interest) <= 200),
  preferred_date   date,
  participants     integer check (participants between 1 and 100),
  message          text not null check (char_length(message) between 10 and 5000),
  locale           text not null default 'el' check (locale in ('el', 'en')),
  consent_at       timestamptz not null,
  idempotency_key  uuid not null unique,
  status_changed_at timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
drop policy if exists "contact_messages admin read" on public.contact_messages;
create policy "contact_messages admin read" on public.contact_messages for select to authenticated
  using ((select public.is_admin()));
-- No insert/update/delete for website visitors or the browser: rows come only
-- from submit_contact_message(); statuses change only through admin_set_contact_status().
revoke insert, update, delete on public.contact_messages from anon, authenticated;

create or replace function public.submit_contact_message(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key   uuid;
  v_row   public.contact_messages%rowtype;
  v_ref   text;
  v_id    uuid;
  v_email text := lower(btrim(coalesce(p->>'email', '')));
  v_date  date;
  v_people integer;
begin
  begin
    v_key := (p->>'idempotency_key')::uuid;
    v_date := nullif(p->>'preferred_date', '')::date;
    v_people := nullif(p->>'participants', '')::integer;
  exception when others then
    raise exception 'invalid' using errcode = 'P0001';
  end;
  if v_key is null then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'consent' using errcode = 'P0001';
  end if;

  -- Same form submitted twice (double click, retry): return the first result.
  select * into v_row from public.contact_messages where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_row.id, 'reference', v_row.reference, 'replayed', true);
  end if;

  for attempt in 1..5 loop
    v_ref := public.new_reference('MSG');
    begin
      insert into public.contact_messages (
        reference, name, email, phone, interest, preferred_date, participants, message, locale, consent_at, idempotency_key
      ) values (
        v_ref, btrim(p->>'name'), v_email, nullif(btrim(p->>'phone'), ''), nullif(btrim(p->>'interest'), ''),
        v_date, v_people, btrim(p->>'message'), coalesce(nullif(p->>'locale', ''), 'el'), now(), v_key
      ) returning id into v_id;
      exit;
    exception
      when unique_violation then
        select * into v_row from public.contact_messages where idempotency_key = v_key;
        if found then
          return jsonb_build_object('id', v_row.id, 'reference', v_row.reference, 'replayed', true);
        end if;
        if attempt = 5 then raise; end if;
      when check_violation or not_null_violation then
        raise exception 'invalid' using errcode = 'P0001';
    end;
  end loop;

  return jsonb_build_object('id', v_id, 'reference', v_ref, 'replayed', false);
end;
$$;
revoke execute on function public.submit_contact_message(jsonb) from public, anon, authenticated;
grant execute on function public.submit_contact_message(jsonb) to service_role;

create or replace function public.admin_set_contact_status(p_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('new', 'in_progress', 'closed') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  update public.contact_messages
  set status = p_status, status_changed_at = now()
  where id = p_id and status <> p_status;
end;
$$;
revoke all on function public.admin_set_contact_status(uuid, text) from public, anon;
grant execute on function public.admin_set_contact_status(uuid, text) to authenticated;
