-- ============================================================================
-- 0013 — First-party website analytics (consent-based).
-- Applied after 0001–0012. Additive and safe to re-run. Touches no existing
-- table except reading excursions/bookings.
--
-- What is stored
--   analytics_sessions — one row per browsing session of a visitor who
--                        ACCEPTED analytics in the cookie banner. First-touch
--                        attributes only: entry page, referrer host, UTM tags,
--                        traffic channel, device/browser/OS class, screen size
--                        class, country/region/city derived from the IP by the
--                        host (the IP itself is never stored).
--   analytics_events   — page views and a fixed list of interaction events.
--
-- What is never stored: IP addresses, names, emails, phone numbers, form
-- contents, full URLs with query strings (only the path), fingerprints.
-- visitor_id / session_id are random UUIDs created in the visitor's browser
-- after consent; deleting them (consent withdrawal) also deletes their rows
-- through analytics_forget().
--
-- Access
--   * Nobody can read or write these tables with the public key: RLS is on
--     and there are no policies.
--   * Writes: analytics_ingest(), analytics_record_booking(),
--     analytics_forget() — executable only with the server's secret key
--     (service_role), i.e. only through the website's own API routes, which
--     validate, rate-limit and drop bots/admin traffic first.
--   * Reads: analytics_* report functions — admins only (is_admin()), always
--     aggregated, date range capped at 400 days.
--
-- Retention: raw sessions/events older than 13 months are deleted nightly
-- (pg_cron job "analytics-retention").
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_sessions (
  id             uuid primary key,
  visitor_id     uuid not null,
  started_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  is_new_visitor boolean not null default false,
  entry_path     text not null check (char_length(entry_path) between 1 and 300),
  exit_path      text check (char_length(exit_path) <= 300),
  exit_at        timestamptz,
  pageviews      integer not null default 0 check (pageviews >= 0),
  interactions   integer not null default 0 check (interactions >= 0),
  engaged_ms     bigint not null default 0 check (engaged_ms >= 0),
  converted      boolean not null default false,
  locale         text check (locale in ('el', 'en')),
  referrer_host  text check (char_length(referrer_host) <= 253),
  utm_source     text check (char_length(utm_source) <= 100),
  utm_medium     text check (char_length(utm_medium) <= 100),
  utm_campaign   text check (char_length(utm_campaign) <= 100),
  utm_term       text check (char_length(utm_term) <= 100),
  utm_content    text check (char_length(utm_content) <= 100),
  channel        text not null check (channel in ('direct', 'organic', 'social', 'referral', 'paid', 'email', 'unclassified')),
  device         text not null check (device in ('desktop', 'mobile', 'tablet', 'other')),
  browser        text check (char_length(browser) <= 40),
  os             text check (char_length(os) <= 40),
  screen         text check (screen in ('small', 'medium', 'large', 'xlarge')),
  country        text check (country ~ '^[A-Z]{2}$'),
  region         text check (char_length(region) <= 80),
  city           text check (char_length(city) <= 80)
);

comment on table public.analytics_sessions is
  'Website analytics: one row per browsing session of a visitor who consented. No IP, no personal data.';

create index if not exists analytics_sessions_started_idx on public.analytics_sessions (started_at);
create index if not exists analytics_sessions_last_seen_idx on public.analytics_sessions (last_seen_at);
create index if not exists analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id);

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  client_id    uuid unique, -- id created in the browser: retries/double sends are ignored
  session_id   uuid not null references public.analytics_sessions (id) on delete cascade,
  visitor_id   uuid not null,
  occurred_at  timestamptz not null default now(),
  name         text not null check (name in (
                 'page_view', 'session_start', 'excursion_view', 'booking_button_click',
                 'booking_form_open', 'booking_form_start', 'booking_form_submit',
                 'booking_request_success', 'booking_request_failure',
                 'search_performed', 'filter_applied')),
  path         text not null check (char_length(path) between 1 and 300),
  title        text check (char_length(title) <= 200),
  excursion_id uuid references public.excursions (id) on delete set null,
  booking_id   uuid references public.bookings (id) on delete set null,
  engaged_ms   integer not null default 0 check (engaged_ms between 0 and 86400000),
  props        jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 2048)
);

comment on table public.analytics_events is
  'Website analytics events (page views and a fixed list of interactions). No personal data.';

create index if not exists analytics_events_time_idx on public.analytics_events (occurred_at);
create index if not exists analytics_events_name_time_idx on public.analytics_events (name, occurred_at);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id, occurred_at);
create index if not exists analytics_events_excursion_idx on public.analytics_events (excursion_id, occurred_at)
  where excursion_id is not null;
-- A booking request can be a conversion only once, whatever retries happen.
create unique index if not exists analytics_events_one_conversion on public.analytics_events (booking_id)
  where name = 'booking_request_success';

alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
-- No policies on purpose: the public and signed-in roles can neither read nor write.
revoke all on public.analytics_sessions from anon, authenticated;
revoke all on public.analytics_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ingestion (service_role only — called by /api/collect)
-- p = { session: {...first-touch attributes}, events: [...], engagement: [...] }
-- Everything in p has already been validated and normalised by the API.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_ingest(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s            jsonb := p -> 'session';
  v_sid        uuid := (s ->> 'id')::uuid;
  v_vid        uuid := (s ->> 'visitor_id')::uuid;
  v_owner      uuid;
  e            jsonb;
  v_at         timestamptz;
  v_name       text;
  v_exc        uuid;
  v_inserted   integer := 0;
  v_pv         integer := 0;
  v_inter      integer := 0;
  v_pv_path    text;
  v_pv_at      timestamptz;
  v_engaged    boolean := false;
begin
  if v_sid is null or v_vid is null then
    raise exception 'invalid' using errcode = '22023';
  end if;

  -- The session is created on first sight; its attributes are first-touch and never change.
  insert into public.analytics_sessions (
    id, visitor_id, is_new_visitor, entry_path, locale, referrer_host,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, channel,
    device, browser, os, screen, country, region, city
  ) values (
    v_sid, v_vid, coalesce((s ->> 'is_new_visitor')::boolean, false), s ->> 'entry_path', s ->> 'locale',
    nullif(s ->> 'referrer_host', ''),
    nullif(s ->> 'utm_source', ''), nullif(s ->> 'utm_medium', ''), nullif(s ->> 'utm_campaign', ''),
    nullif(s ->> 'utm_term', ''), nullif(s ->> 'utm_content', ''), s ->> 'channel',
    s ->> 'device', nullif(s ->> 'browser', ''), nullif(s ->> 'os', ''), nullif(s ->> 'screen', ''),
    nullif(s ->> 'country', ''), nullif(s ->> 'region', ''), nullif(s ->> 'city', '')
  )
  on conflict (id) do nothing;

  -- A session id always belongs to the visitor who created it.
  select visitor_id into v_owner from public.analytics_sessions where id = v_sid;
  if v_owner is distinct from v_vid then
    return jsonb_build_object('ok', false, 'error', 'session_mismatch');
  end if;

  for e in select value from jsonb_array_elements(coalesce(p -> 'events', '[]'::jsonb)) loop
    v_name := e ->> 'name';
    -- booking_request_success / _failure are recorded by the server only.
    continue when v_name in ('booking_request_success', 'booking_request_failure');
    v_at := coalesce((e ->> 'at')::timestamptz, now());
    v_exc := null;
    if nullif(e ->> 'excursion_id', '') is not null then
      select x.id into v_exc from public.excursions x where x.id = (e ->> 'excursion_id')::uuid;
    end if;

    insert into public.analytics_events (client_id, session_id, visitor_id, occurred_at, name, path, title, excursion_id, props)
    values (
      (e ->> 'id')::uuid, v_sid, v_vid, v_at, v_name, e ->> 'path', nullif(e ->> 'title', ''), v_exc,
      coalesce(e -> 'props', '{}'::jsonb)
    )
    on conflict do nothing;

    if found then
      v_inserted := v_inserted + 1;
      if v_name = 'page_view' then
        v_pv := v_pv + 1;
        if v_pv_at is null or v_at >= v_pv_at then
          v_pv_at := v_at;
          v_pv_path := e ->> 'path';
        end if;
      elsif v_name in ('booking_button_click', 'booking_form_open', 'booking_form_start', 'booking_form_submit',
                       'search_performed', 'filter_applied') then
        v_inter := v_inter + 1;
      end if;
    end if;
  end loop;

  -- Engaged (visible) time per page view; cumulative values, so resends are harmless.
  for e in select value from jsonb_array_elements(coalesce(p -> 'engagement', '[]'::jsonb)) loop
    update public.analytics_events
    set engaged_ms = greatest(engaged_ms, least(greatest((e ->> 'ms')::integer, 0), 86400000))
    where client_id = (e ->> 'id')::uuid and session_id = v_sid and name = 'page_view';
    v_engaged := v_engaged or found;
  end loop;

  update public.analytics_sessions ss
  set last_seen_at = greatest(ss.last_seen_at, now()),
      pageviews    = ss.pageviews + v_pv,
      interactions = ss.interactions + v_inter,
      exit_path    = case when v_pv_at is not null and v_pv_at >= coalesce(ss.exit_at, '-infinity'::timestamptz) then v_pv_path else ss.exit_path end,
      exit_at      = case when v_pv_at is not null and v_pv_at >= coalesce(ss.exit_at, '-infinity'::timestamptz) then v_pv_at else ss.exit_at end,
      engaged_ms   = case when v_engaged
                       then (select coalesce(sum(ev.engaged_ms), 0) from public.analytics_events ev
                             where ev.session_id = v_sid and ev.name = 'page_view')
                       else ss.engaged_ms end
  where ss.id = v_sid;

  return jsonb_build_object('ok', true, 'inserted', v_inserted);
end;
$$;
revoke all on function public.analytics_ingest(jsonb) from public, anon, authenticated;
grant execute on function public.analytics_ingest(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Booking outcome (service_role only — called by /api/bookings after the
--    database has confirmed the request). A conversion needs a real booking
--    row; the unique index above makes it count exactly once.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_record_booking(
  p_session   uuid,
  p_visitor   uuid,
  p_ok        boolean,
  p_booking   uuid,
  p_excursion uuid,
  p_path      text,
  p_reason    text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_exc uuid;
begin
  -- Only for a session that exists and belongs to this visitor (consenting visitor).
  if not exists (select 1 from public.analytics_sessions where id = p_session and visitor_id = p_visitor) then
    return false;
  end if;

  if p_ok then
    select b.excursion_id into v_exc from public.bookings b where b.id = p_booking;
    if v_exc is null then
      return false; -- no confirmed booking row, no conversion
    end if;
    insert into public.analytics_events (session_id, visitor_id, name, path, excursion_id, booking_id)
    values (p_session, p_visitor, 'booking_request_success', left(coalesce(p_path, '/'), 300), v_exc, p_booking)
    on conflict do nothing;
    if found then
      update public.analytics_sessions
      set converted = true, last_seen_at = greatest(last_seen_at, now())
      where id = p_session;
    end if;
  else
    select x.id into v_exc from public.excursions x where x.id = p_excursion;
    insert into public.analytics_events (session_id, visitor_id, name, path, excursion_id, props)
    values (p_session, p_visitor, 'booking_request_failure', left(coalesce(p_path, '/'), 300), v_exc,
            jsonb_build_object('reason', left(coalesce(p_reason, 'unknown'), 40)));
  end if;
  return true;
end;
$$;
revoke all on function public.analytics_record_booking(uuid, uuid, boolean, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.analytics_record_booking(uuid, uuid, boolean, uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Consent withdrawal: delete everything recorded for a visitor id.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_forget(p_visitor uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.analytics_events where visitor_id = p_visitor;
  delete from public.analytics_sessions where visitor_id = p_visitor;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.analytics_forget(uuid) from public, anon, authenticated;
grant execute on function public.analytics_forget(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Retention: raw data older than 13 months is deleted every night.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_purge()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.analytics_events where occurred_at < now() - interval '13 months';
  delete from public.analytics_sessions where last_seen_at < now() - interval '13 months';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.analytics_purge() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('analytics-retention', '17 2 * * *', $cron$select public.analytics_purge()$cron$);

-- ---------------------------------------------------------------------------
-- 6. Admin reports. Every function checks is_admin() and the date range and
--    returns aggregates only — never individual visitor rows or ids.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_guard(p_from timestamptz, p_to timestamptz)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'invalid range' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.analytics_guard(timestamptz, timestamptz) from public, anon, authenticated;

-- 6.1 KPI summary for one period
create or replace function public.analytics_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.analytics_guard(p_from, p_to);
  with s as (
    select * from public.analytics_sessions where started_at >= p_from and started_at < p_to
  ), v as (
    select visitor_id, bool_or(is_new_visitor) as is_new from s group by visitor_id
  )
  select jsonb_build_object(
    'pageviews', (select count(*) from public.analytics_events
                  where name = 'page_view' and occurred_at >= p_from and occurred_at < p_to),
    'visitors', (select count(*) from v),
    'new_visitors', (select count(*) from v where is_new),
    'returning_visitors', (select count(*) from v where not is_new),
    'sessions', (select count(*) from s),
    'avg_session_seconds', (select round(avg(extract(epoch from (last_seen_at - started_at)))::numeric, 1) from s),
    'pages_per_session', (select round(avg(pageviews)::numeric, 2) from s),
    -- Bounce: one page view, under 10 s visible, no interaction, no conversion.
    'bounce_rate', (select round(avg(case when pageviews <= 1 and engaged_ms < 10000 and interactions = 0 and not converted then 1 else 0 end)::numeric, 4) from s),
    'conversions', (select count(*) from public.analytics_events
                    where name = 'booking_request_success' and occurred_at >= p_from and occurred_at < p_to),
    'first_session_at', (select min(started_at) from public.analytics_sessions)
  ) into r;
  return r;
end;
$$;

-- 6.2 Traffic over time (Athens calendar days or hours)
create or replace function public.analytics_timeseries(p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns table (bucket timestamp, pageviews bigint, visitors bigint, sessions bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_guard(p_from, p_to);
  if p_bucket not in ('day', 'hour') or (p_bucket = 'hour' and p_to - p_from > interval '3 days') then
    raise exception 'invalid bucket' using errcode = '22023';
  end if;
  return query
  with b as (
    select generate_series(
      date_trunc(p_bucket, p_from at time zone 'Europe/Athens'),
      (p_to - interval '1 microsecond') at time zone 'Europe/Athens',
      ('1 ' || p_bucket)::interval
    ) as k
  ), pv as (
    select date_trunc(p_bucket, occurred_at at time zone 'Europe/Athens') as k, count(*) as n
    from public.analytics_events
    where name = 'page_view' and occurred_at >= p_from and occurred_at < p_to
    group by 1
  ), ss as (
    select date_trunc(p_bucket, started_at at time zone 'Europe/Athens') as k,
           count(distinct visitor_id) as vis, count(*) as n
    from public.analytics_sessions
    where started_at >= p_from and started_at < p_to
    group by 1
  )
  select b.k, coalesce(pv.n, 0), coalesce(ss.vis, 0), coalesce(ss.n, 0)
  from b left join pv on pv.k = b.k left join ss on ss.k = b.k
  order by b.k;
end;
$$;

-- 6.3 Popular pages (sortable, paginated)
create or replace function public.analytics_pages(
  p_from timestamptz, p_to timestamptz, p_sort text default 'views', p_limit integer default 20, p_offset integer default 0
)
returns table (path text, title text, views bigint, visitors bigint, avg_engaged_seconds numeric, share numeric, total_rows bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_guard(p_from, p_to);
  return query
  with pv as (
    select e.path, e.title, e.visitor_id, e.engaged_ms, e.occurred_at
    from public.analytics_events e
    where e.name = 'page_view' and e.occurred_at >= p_from and e.occurred_at < p_to
  ), tot as (
    select count(*)::numeric as n from pv
  ), g as (
    select pv.path,
           (array_agg(pv.title order by pv.occurred_at desc) filter (where pv.title is not null))[1] as title,
           count(*) as views,
           count(distinct pv.visitor_id) as visitors,
           round((avg(pv.engaged_ms) filter (where pv.engaged_ms > 0) / 1000)::numeric, 1) as avg_engaged_seconds
    from pv group by pv.path
  )
  select g.path, g.title, g.views, g.visitors, g.avg_engaged_seconds,
         round(g.views / nullif(tot.n, 0), 4), count(*) over ()
  from g, tot
  order by
    case when p_sort = 'visitors' then g.visitors end desc nulls last,
    case when p_sort = 'engagement' then g.avg_engaged_seconds end desc nulls last,
    case when p_sort = 'path' then g.path end asc,
    g.views desc, g.path
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- 6.4 Entry pages, exit pages and the most common page-to-page steps
create or replace function public.analytics_behavior(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.analytics_guard(p_from, p_to);
  select jsonb_build_object(
    'entry', coalesce((
      select jsonb_agg(x order by x.sessions desc, x.path) from (
        select entry_path as path, count(*) as sessions
        from public.analytics_sessions where started_at >= p_from and started_at < p_to
        group by entry_path order by count(*) desc, entry_path limit 10
      ) x), '[]'::jsonb),
    'exit', coalesce((
      select jsonb_agg(x order by x.sessions desc, x.path) from (
        select exit_path as path, count(*) as sessions
        from public.analytics_sessions where started_at >= p_from and started_at < p_to and exit_path is not null
        group by exit_path order by count(*) desc, exit_path limit 10
      ) x), '[]'::jsonb),
    'flows', coalesce((
      select jsonb_agg(x order by x.n desc) from (
        select t.path as from_path, t.next_path as to_path, count(*) as n
        from (
          select e.path, lead(e.path) over (partition by e.session_id order by e.occurred_at, e.id) as next_path
          from public.analytics_events e
          where e.name = 'page_view' and e.occurred_at >= p_from and e.occurred_at < p_to
        ) t
        where t.next_path is not null and t.next_path <> t.path
        group by 1, 2 order by 3 desc, 1, 2 limit 15
      ) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- 6.5 Booking funnel — distinct visitors who reached each step (or a later one)
create or replace function public.analytics_funnel(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.analytics_guard(p_from, p_to);
  with ev as (
    select visitor_id,
           max(case name
                 when 'excursion_view' then 2
                 when 'booking_button_click' then 3
                 when 'booking_form_open' then 4
                 when 'booking_form_start' then 5
                 when 'booking_request_success' then 6
               end) as stage,
           bool_or(name = 'booking_button_click') as clicked,
           bool_or(name = 'booking_form_submit') as submitted,
           bool_or(name = 'booking_request_failure') as failed
    from public.analytics_events
    where occurred_at >= p_from and occurred_at < p_to
      and name in ('excursion_view', 'booking_button_click', 'booking_form_open', 'booking_form_start',
                   'booking_form_submit', 'booking_request_success', 'booking_request_failure')
    group by visitor_id
  ), base as (
    select visitor_id from public.analytics_sessions where started_at >= p_from and started_at < p_to
    union
    select visitor_id from ev
  ), j as (
    select coalesce(ev.stage, 1) as stage, coalesce(ev.clicked, false) as clicked,
           coalesce(ev.submitted, false) as submitted, coalesce(ev.failed, false) as failed
    from base left join ev using (visitor_id)
  )
  select jsonb_build_object(
    'entered', count(*),
    'viewed_excursion', count(*) filter (where stage >= 2),
    'clicked_or_later', count(*) filter (where stage >= 3),
    'opened_form', count(*) filter (where stage >= 4),
    'started_form', count(*) filter (where stage >= 5),
    'submitted_ok', count(*) filter (where stage >= 6),
    'clicked_button', count(*) filter (where clicked),
    'submit_attempts', count(*) filter (where submitted),
    'had_failure', count(*) filter (where failed)
  ) into r
  from j;
  return r;
end;
$$;

-- 6.6 Excursion popularity
create or replace function public.analytics_excursions(p_from timestamptz, p_to timestamptz, p_limit integer default 20)
returns table (excursion_id uuid, title text, slug text, views bigint, visitors bigint, clickers bigint, conversions bigint, all_requests bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.analytics_guard(p_from, p_to);
  return query
  with ev as (
    select e.excursion_id,
           count(*) filter (where e.name = 'excursion_view') as views,
           count(distinct e.visitor_id) filter (where e.name = 'excursion_view') as visitors,
           count(distinct e.visitor_id) filter (where e.name = 'booking_button_click') as clickers,
           count(*) filter (where e.name = 'booking_request_success') as conversions
    from public.analytics_events e
    where e.excursion_id is not null and e.occurred_at >= p_from and e.occurred_at < p_to
      and e.name in ('excursion_view', 'booking_button_click', 'booking_request_success')
    group by e.excursion_id
  ), req as (
    select b.excursion_id, count(*) as n
    from public.bookings b
    where b.created_at >= p_from and b.created_at < p_to
    group by b.excursion_id
  )
  select x.id, coalesce(nullif(x.title_el, ''), x.title_en), x.slug,
         coalesce(ev.views, 0), coalesce(ev.visitors, 0), coalesce(ev.clickers, 0), coalesce(ev.conversions, 0),
         coalesce(req.n, 0)
  from public.excursions x
  left join ev on ev.excursion_id = x.id
  left join req on req.excursion_id = x.id
  where ev.excursion_id is not null or req.excursion_id is not null
  order by coalesce(ev.views, 0) desc, coalesce(req.n, 0) desc, x.slug
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- 6.7 Traffic sources
create or replace function public.analytics_sources(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.analytics_guard(p_from, p_to);
  with s as (
    select * from public.analytics_sessions where started_at >= p_from and started_at < p_to
  )
  select jsonb_build_object(
    'channels', coalesce((
      select jsonb_agg(x order by x.sessions desc) from (
        select channel, count(*) as sessions, count(distinct visitor_id) as visitors,
               count(*) filter (where converted) as conversions
        from s group by channel
      ) x), '[]'::jsonb),
    'detail', coalesce((
      select jsonb_agg(x order by x.sessions desc) from (
        select channel, coalesce(utm_source, referrer_host) as source, utm_medium as medium, utm_campaign as campaign,
               count(*) as sessions, count(distinct visitor_id) as visitors,
               count(*) filter (where converted) as conversions
        from s group by 1, 2, 3, 4 order by count(*) desc limit 50
      ) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- 6.8 Devices, browsers, systems, screens, locations
create or replace function public.analytics_tech(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  perform public.analytics_guard(p_from, p_to);
  with s as (
    select * from public.analytics_sessions where started_at >= p_from and started_at < p_to
  )
  select jsonb_build_object(
    'device', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select device as key, count(*) as sessions, count(distinct visitor_id) as visitors from s group by 1) x), '[]'::jsonb),
    'browser', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select coalesce(browser, '') as key, count(*) as sessions, count(distinct visitor_id) as visitors from s group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'os', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select coalesce(os, '') as key, count(*) as sessions, count(distinct visitor_id) as visitors from s group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'screen', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select coalesce(screen, '') as key, count(*) as sessions, count(distinct visitor_id) as visitors from s group by 1) x), '[]'::jsonb),
    'country', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select coalesce(country, '') as key, count(*) as sessions, count(distinct visitor_id) as visitors from s group by 1 order by 2 desc limit 25) x), '[]'::jsonb),
    'region', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select country, region as key, count(*) as sessions, count(distinct visitor_id) as visitors
      from s where region is not null group by 1, 2 order by 3 desc limit 15) x), '[]'::jsonb),
    'city', coalesce((select jsonb_agg(x order by x.sessions desc) from (
      select country, city as key, count(*) as sessions, count(distinct visitor_id) as visitors
      from s where city is not null group by 1, 2 order by 3 desc limit 15) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- 6.9 Real time: sessions active in the last 5 minutes
create or replace function public.analytics_realtime()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_since timestamptz := now() - interval '5 minutes';
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  with act as (
    select id, visitor_id, device, country from public.analytics_sessions where last_seen_at >= v_since
  ), cur as (
    -- the page each active session is on now (its latest page view)
    select distinct on (e.session_id) e.session_id, e.path, e.title
    from public.analytics_events e
    join act on act.id = e.session_id
    where e.name = 'page_view' and e.occurred_at >= now() - interval '6 hours'
    order by e.session_id, e.occurred_at desc, e.id desc
  )
  select jsonb_build_object(
    'window_minutes', 5,
    'active_visitors', (select count(distinct visitor_id) from act),
    'active_sessions', (select count(*) from act),
    'pages', coalesce((select jsonb_agg(x order by x.n desc) from (
      select path, max(title) as title, count(*) as n from cur group by path order by count(*) desc limit 10) x), '[]'::jsonb),
    'excursions', coalesce((select jsonb_agg(x order by x.n desc) from (
      select x.id, coalesce(nullif(x.title_el, ''), x.title_en) as title, count(*) as n
      from cur join public.excursions x on x.slug = split_part(cur.path, '/', 4)
      where cur.path ~ '^/(el|en)/activities/[a-z0-9-]+$'
      group by x.id, 2 order by count(*) desc limit 10) x), '[]'::jsonb),
    'per_minute', coalesce((select jsonb_agg(x order by x.minute) from (
      select date_trunc('minute', occurred_at) as minute, count(*) as n
      from public.analytics_events
      where name = 'page_view' and occurred_at >= now() - interval '30 minutes'
      group by 1) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(x order by x.at desc) from (
      select e.occurred_at as at, e.name, e.path, coalesce(nullif(x.title_el, ''), x.title_en) as excursion,
             s.device, s.country
      from public.analytics_events e
      join public.analytics_sessions s on s.id = e.session_id
      left join public.excursions x on x.id = e.excursion_id
      where e.occurred_at >= now() - interval '30 minutes' and e.name <> 'session_start'
      order by e.occurred_at desc, e.id desc limit 25) x), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- Report functions: admins (signed in) only; is_admin() is checked inside.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'analytics_summary(timestamptz, timestamptz)',
    'analytics_timeseries(timestamptz, timestamptz, text)',
    'analytics_pages(timestamptz, timestamptz, text, integer, integer)',
    'analytics_behavior(timestamptz, timestamptz)',
    'analytics_funnel(timestamptz, timestamptz)',
    'analytics_excursions(timestamptz, timestamptz, integer)',
    'analytics_sources(timestamptz, timestamptz)',
    'analytics_tech(timestamptz, timestamptz)',
    'analytics_realtime()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
