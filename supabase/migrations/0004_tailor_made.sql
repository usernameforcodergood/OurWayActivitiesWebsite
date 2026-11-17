-- ============================================================================
-- OurWay — Tailor-Made Experiences
-- Applied after 0001–0003. Safe to re-run.
--
-- The "design your own trip" requests introduced in 0003 (public.private_requests)
-- become the Tailor-Made Requests. No new table is created: the existing table
-- already keeps these requests apart from excursion bookings, and its status
-- history, internal notes and email log keep working unchanged.
--
-- Changes:
--   * New request fields: experience_type (category) and additional_requirements.
--   * Statuses: new, in_review, contacted, quotation_sent, confirmed, completed,
--     rejected. Existing rows and their history are mapped to the new values
--     (planning → in_review, proposal_sent → quotation_sent, accepted → confirmed).
--   * New references use the "TM-" prefix; existing "PG-" references stay valid.
--   * Admins may edit the request details and delete requests.
--     Visitors still cannot read, edit or delete anything.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- New request fields
-- ---------------------------------------------------------------------------
alter table public.private_requests
  add column if not exists experience_type         text,
  add column if not exists additional_requirements text;

do $$ begin
  alter table public.private_requests add constraint private_requests_experience_type_check
    check (experience_type in ('hiking', 'adventure', 'nature', 'culture', 'gastronomy', 'multi_day', 'other'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.private_requests add constraint private_requests_additional_requirements_len
    check (char_length(additional_requirements) <= 2000);
exception when duplicate_object then null; end $$;

create index if not exists private_requests_created_idx on public.private_requests (created_at desc);
create index if not exists private_requests_type_idx on public.private_requests (experience_type, created_at desc);

-- ---------------------------------------------------------------------------
-- Statuses
-- ---------------------------------------------------------------------------
alter table public.private_requests drop constraint if exists private_requests_status_check;

update public.private_requests
set status = case status
  when 'planning'      then 'in_review'
  when 'proposal_sent' then 'quotation_sent'
  when 'accepted'      then 'confirmed'
  else status end
where status in ('planning', 'proposal_sent', 'accepted');

alter table public.private_requests add constraint private_requests_status_check
  check (status in ('new', 'in_review', 'contacted', 'quotation_sent', 'confirmed', 'completed', 'rejected'));

-- Workflow order, so the admin list can sort "by status" meaningfully.
alter table public.private_requests
  add column if not exists status_rank smallint generated always as (
    case status
      when 'new' then 1 when 'in_review' then 2 when 'contacted' then 3 when 'quotation_sent' then 4
      when 'confirmed' then 5 when 'completed' then 6 when 'rejected' then 7 else 9 end
  ) stored;
create index if not exists private_requests_status_rank_idx on public.private_requests (status_rank, created_at desc);

-- Keep the status history readable with the new names.
update public.request_status_history
set from_status = case from_status
      when 'planning' then 'in_review' when 'proposal_sent' then 'quotation_sent' when 'accepted' then 'confirmed'
      else from_status end,
    to_status = case to_status
      when 'planning' then 'in_review' when 'proposal_sent' then 'quotation_sent' when 'accepted' then 'confirmed'
      else to_status end
where private_request_id is not null
  and (from_status in ('planning', 'proposal_sent', 'accepted') or to_status in ('planning', 'proposal_sent', 'accepted'));

-- ---------------------------------------------------------------------------
-- References: TM-XXXXXX for new requests, PG-XXXXXX still accepted.
-- ---------------------------------------------------------------------------
alter table public.private_requests drop constraint if exists private_requests_reference_check;
alter table public.private_requests add constraint private_requests_reference_check
  check (reference ~ '^(PG|TM)-[A-Z0-9]{6}$');

-- ---------------------------------------------------------------------------
-- Public submission (replaces the 0003 version; same signature)
-- ---------------------------------------------------------------------------
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

  -- Same form submitted twice (double click, retry): return the first result.
  select * into v_existing from public.private_requests where idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'replayed', true,
      'email_sent', exists (select 1 from public.email_notifications n where n.private_request_id = v_existing.id and n.kind = 'private_received' and n.status = 'sent'));
  end if;

  -- Accidental duplicates / floods: one request per email every 30 minutes.
  if exists (
    select 1 from public.private_requests r
    where lower(r.email) = v_email and r.created_at > now() - interval '30 minutes'
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;

  for attempt in 1..5 loop
    v_ref := public.new_reference('TM');
    begin
      insert into public.private_requests (
        reference, first_name, last_name, email, phone, participants,
        destination, destination_flexible, excursion_type, experience_type,
        date_from, date_to, dates_flexible,
        duration, difficulty, transport, activities, budget_per_person, message, additional_requirements, locale,
        consent_at, idempotency_key, notify_token_hash
      ) values (
        v_ref, btrim(p->>'first_name'), btrim(p->>'last_name'), v_email, btrim(p->>'phone'), v_people,
        nullif(btrim(p->>'destination'), ''), coalesce((p->>'destination_flexible')::boolean, false),
        nullif(btrim(p->>'excursion_type'), ''), nullif(btrim(p->>'experience_type'), ''),
        nullif(p->>'date_from', '')::date, nullif(p->>'date_to', '')::date,
        coalesce((p->>'dates_flexible')::boolean, false),
        nullif(btrim(p->>'duration'), ''), nullif(btrim(p->>'difficulty'), ''),
        nullif(btrim(p->>'transport'), ''), nullif(btrim(p->>'activities'), ''),
        nullif(btrim(p->>'budget_per_person'), ''), nullif(btrim(p->>'message'), ''),
        nullif(btrim(p->>'additional_requirements'), ''),
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

-- ---------------------------------------------------------------------------
-- Admin permissions: edit details, delete requests
-- (RLS: the existing "private_requests admin update" policy already limits
--  updates to admins; status still changes only through
--  admin_set_private_request_status(), which writes the history.)
-- ---------------------------------------------------------------------------
revoke update on public.private_requests from anon, authenticated;
grant update (
  first_name, last_name, email, phone, participants,
  destination, experience_type, date_from, date_to, dates_flexible,
  budget_per_person, message, additional_requirements,
  proposal_itinerary, proposal_dates, proposal_price_eur
) on public.private_requests to authenticated;

drop policy if exists "private_requests admin delete" on public.private_requests;
create policy "private_requests admin delete" on public.private_requests for delete to authenticated
  using ((select public.is_admin()));
revoke delete on public.private_requests from anon;
grant delete on public.private_requests to authenticated;
-- History, notes and email log rows are removed with the request (on delete cascade).

-- Visitors never get direct table access.
revoke all on public.private_requests from anon;
