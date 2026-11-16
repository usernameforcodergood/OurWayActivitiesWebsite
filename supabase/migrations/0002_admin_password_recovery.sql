-- ============================================================================
-- OurWay — administrator password recovery (eligibility check)
-- Applied by `npm run db:setup` after 0001. Safe to re-run.
--
-- The website must only send password-reset emails to administrators, but it
-- must never reveal to the public whether an email belongs to one. The check
-- below therefore only answers callers that present the server-only
-- ADMIN_RECOVERY_KEY (stored here as a SHA-256 hash, set with
-- `npm run admin:recovery-key`). Anyone calling the function through the
-- public API without that key gets a permission error, never a yes/no.
-- ============================================================================

-- Private schema: not exposed through the Supabase Data API.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_secrets (
  name        text primary key,
  secret_hash bytea not null,
  updated_at  timestamptz not null default now()
);
alter table private.app_secrets enable row level security; -- no policies: API roles see nothing
revoke all on table private.app_secrets from public;
revoke all on table private.app_secrets from anon, authenticated;

create or replace function public.admin_recovery_eligible(p_email text, p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expected bytea;
begin
  select s.secret_hash into expected from private.app_secrets s where s.name = 'admin_recovery';
  if expected is null or p_key is null or length(p_key) < 32
     or sha256(convert_to(p_key, 'UTF8')) <> expected then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return exists (
    select 1
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    where lower(u.email) = lower(btrim(p_email))
      and u.deleted_at is null
      and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until < now())
  );
end;
$$;

revoke all on function public.admin_recovery_eligible(text, text) from public;
grant execute on function public.admin_recovery_eligible(text, text) to anon, authenticated;
