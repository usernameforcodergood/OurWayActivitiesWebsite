-- ============================================================================
-- OurWay — public form submissions only through the website's server
-- Applied after 0001–0004. Safe to re-run (also after re-running 0003/0004).
--
-- submit_booking_request() and submit_private_request() are callable with the
-- public (publishable) key, so anyone could call them directly and skip the
-- website's spam checks (honeypot, fill timer, rate limit). From now on they
-- only accept calls that include the server-only SUBMISSION_KEY
-- (payload field "submission_key"), stored here as a SHA-256 hash under the
-- name 'submissions' in private.app_secrets (see 0002). Without a matching
-- key the call fails with "not allowed" and nothing is written.
--
-- How: the real functions move to the private schema (not exposed through the
-- Data API) as *_impl, and the public names become thin wrappers that check
-- the key first. Signatures and return values are unchanged.
--
-- Set the key BEFORE applying this migration (see scripts/submission-key.mjs):
--   insert into private.app_secrets (name, secret_hash) values ('submissions', <sha256>)
-- otherwise every public form submission is refused.
-- ============================================================================

create or replace function private.submission_key_ok(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expected bytea;
begin
  select s.secret_hash into expected from private.app_secrets s where s.name = 'submissions';
  return expected is not null and p_key is not null and length(p_key) >= 32
     and sha256(convert_to(p_key, 'UTF8')) = expected;
end;
$$;
revoke all on function private.submission_key_ok(text) from public, anon, authenticated;

-- Move the current public implementation to private.<name>_impl, unless the
-- public function already is the key-checking wrapper. (Re-running 0003/0004
-- re-creates the open public version; this then picks it up again.)
do $$
declare
  fn text;
begin
  foreach fn in array array['submit_booking_request', 'submit_private_request'] loop
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
        and pg_get_function_identity_arguments(p.oid) = 'p jsonb'
        and p.prosrc not like '%submission_key_ok%'
    ) then
      execute format('drop function if exists private.%I(jsonb)', fn || '_impl');
      execute format('alter function public.%I(jsonb) set schema private', fn);
      execute format('alter function private.%I(jsonb) rename to %I', fn, fn || '_impl');
    end if;
    execute format('revoke all on function private.%I(jsonb) from public, anon, authenticated', fn || '_impl');
  end loop;
end $$;

create or replace function public.submit_booking_request(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.submission_key_ok(p->>'submission_key') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return private.submit_booking_request_impl(p - 'submission_key');
end;
$$;
revoke all on function public.submit_booking_request(jsonb) from public;
grant execute on function public.submit_booking_request(jsonb) to anon, authenticated;

create or replace function public.submit_private_request(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.submission_key_ok(p->>'submission_key') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return private.submit_private_request_impl(p - 'submission_key');
end;
$$;
revoke all on function public.submit_private_request(jsonb) from public;
grant execute on function public.submit_private_request(jsonb) to anon, authenticated;
