-- ============================================================================
-- OurWay — public form submissions only through the website's server
-- Applied after 0001–0004. Safe to re-run (also after re-running 0003/0004).
--
-- submit_booking_request(), submit_private_request() and
-- record_submission_email() used to be executable with the public
-- (publishable) key, so anyone could call them directly and skip the
-- website's spam checks (honeypot, fill timer, rate limit). The website's API
-- routes now call them with the Supabase secret key (service_role,
-- SUPABASE_SECRET_KEY on the server only), so the public key no longer needs
-- them and loses access here.
--
-- Deploy the code that uses SUPABASE_SECRET_KEY before applying this.
-- ============================================================================

revoke execute on function public.submit_booking_request(jsonb) from public, anon, authenticated;
revoke execute on function public.submit_private_request(jsonb) from public, anon, authenticated;
revoke execute on function public.record_submission_email(text, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.submit_booking_request(jsonb) to service_role;
grant execute on function public.submit_private_request(jsonb) to service_role;
grant execute on function public.record_submission_email(text, text, text, text, text, text) to service_role;

-- Clean-up of an earlier, never-kept version of this migration (key in a
-- payload field). Restores the real functions if they were moved.
do $$
declare
  fn text;
begin
  foreach fn in array array['submit_booking_request', 'submit_private_request'] loop
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.proname = fn || '_impl'
    ) then
      execute format('drop function if exists public.%I(jsonb)', fn);
      execute format('alter function private.%I(jsonb) set schema public', fn || '_impl');
      execute format('alter function public.%I(jsonb) rename to %I', fn || '_impl', fn);
      execute format('revoke execute on function public.%I(jsonb) from public, anon, authenticated', fn);
      execute format('grant execute on function public.%I(jsonb) to service_role', fn);
    end if;
  end loop;
end $$;
drop function if exists private.submission_key_ok(text);
delete from private.app_secrets where name = 'submissions';
