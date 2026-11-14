-- ============================================================================
-- OurWay CMS — schema, security (RLS) and storage
-- Run once on a fresh Supabase project:  npm run db:setup
-- (or paste this file into Supabase → SQL Editor → Run). Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Administrators
-- A user is an admin only if a row exists here. Rows are added with
-- `npm run admin:grant -- email@example.com` (never from the website).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.content_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Media library (files live in the "media" storage bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  width       integer check (width > 0),
  height      integer check (height > 0),
  mime_type   text,
  size_bytes  integer check (size_bytes >= 0),
  alt_el      text,
  alt_en      text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Excursions / experiences
-- Every content field is optional except a slug and at least one title.
-- A language version is shown publicly only when its title + summary exist.
-- ---------------------------------------------------------------------------
create table if not exists public.excursions (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique
                       check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  status               public.content_status not null default 'draft',
  featured             boolean not null default false,
  cover_media_id       uuid references public.media (id) on delete set null,

  title_el             text,
  title_en             text,
  summary_el           text,
  summary_en           text,
  description_el       text,
  description_en       text,
  destination_el       text,
  destination_en       text,
  category_el          text,
  category_en          text,
  duration_el          text,
  duration_en          text,
  difficulty_el        text,
  difficulty_en        text,
  participants         text,
  price_eur            numeric(10, 2) check (price_eur >= 0),
  price_note_el        text,
  price_note_en        text,
  available_dates      date[] not null default '{}',
  availability_note_el text,
  availability_note_en text,
  info_el              text,
  info_en              text,

  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint excursions_has_title
    check (coalesce(btrim(title_el), '') <> '' or coalesce(btrim(title_en), '') <> '')
);

create index if not exists excursions_status_idx on public.excursions (status);
create index if not exists excursions_updated_idx on public.excursions (updated_at desc);

drop trigger if exists excursions_touch on public.excursions;
create trigger excursions_touch before update on public.excursions
  for each row execute function public.touch_updated_at();

create table if not exists public.excursion_images (
  excursion_id uuid not null references public.excursions (id) on delete cascade,
  media_id     uuid not null references public.media (id) on delete cascade,
  position     integer not null default 0,
  primary key (excursion_id, media_id)
);

create index if not exists excursion_images_order_idx on public.excursion_images (excursion_id, position);

-- ---------------------------------------------------------------------------
-- Announcements / news
-- Publicly visible only while: published AND publish_at <= now()
-- AND (expires_at is null OR expires_at > now()).
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  status         public.content_status not null default 'draft',
  featured       boolean not null default false,
  image_media_id uuid references public.media (id) on delete set null,

  title_el       text,
  title_en       text,
  summary_el     text,
  summary_en     text,
  body_el        text,
  body_en        text,

  publish_at     timestamptz not null default now(),
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint announcements_has_title
    check (coalesce(btrim(title_el), '') <> '' or coalesce(btrim(title_en), '') <> ''),
  constraint announcements_expiry_after_publish
    check (expires_at is null or expires_at > publish_at)
);

create index if not exists announcements_live_idx on public.announcements (status, publish_at desc);

drop trigger if exists announcements_touch on public.announcements;
create trigger announcements_touch before update on public.announcements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Site settings (single row): public contact details and social links
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  id            smallint primary key default 1 check (id = 1),
  email         text,
  phone         text,
  address_el    text,
  address_en    text,
  instagram_url text,
  facebook_url  text,
  linkedin_url  text,
  updated_at    timestamptz not null default now()
);

insert into public.site_settings (id, email, phone, instagram_url, facebook_url, linkedin_url)
values (
  1,
  'ourway.activities@gmail.com',
  '+30 693 232 5160',
  'https://www.instagram.com/ourway.activities/',
  'https://www.facebook.com/Ourway.activities/',
  'https://www.linkedin.com/in/ourway-activities-8b4055310'
)
on conflict (id) do nothing;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Row Level Security
-- Visitors (anon) may only READ published/active content.
-- Only admins (is_admin()) may write anything.
-- ============================================================================
alter table public.admin_users      enable row level security;
alter table public.media            enable row level security;
alter table public.excursions       enable row level security;
alter table public.excursion_images enable row level security;
alter table public.announcements    enable row level security;
alter table public.site_settings    enable row level security;

-- admin_users: a signed-in user can see whether they themselves are an admin;
-- admins can see the list. No write policies: managed only via SQL/CLI.
drop policy if exists "admin_users read" on public.admin_users;
create policy "admin_users read" on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- media
drop policy if exists "media public read" on public.media;
create policy "media public read" on public.media for select using (true);
drop policy if exists "media admin insert" on public.media;
create policy "media admin insert" on public.media for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "media admin update" on public.media;
create policy "media admin update" on public.media for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "media admin delete" on public.media;
create policy "media admin delete" on public.media for delete to authenticated
  using ((select public.is_admin()));

-- excursions
drop policy if exists "excursions read" on public.excursions;
create policy "excursions read" on public.excursions for select
  using (status = 'published' or (select public.is_admin()));
drop policy if exists "excursions admin insert" on public.excursions;
create policy "excursions admin insert" on public.excursions for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "excursions admin update" on public.excursions;
create policy "excursions admin update" on public.excursions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "excursions admin delete" on public.excursions;
create policy "excursions admin delete" on public.excursions for delete to authenticated
  using ((select public.is_admin()));

-- excursion_images
drop policy if exists "excursion_images read" on public.excursion_images;
create policy "excursion_images read" on public.excursion_images for select
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.excursions e
      where e.id = excursion_id and e.status = 'published'
    )
  );
drop policy if exists "excursion_images admin write" on public.excursion_images;
create policy "excursion_images admin write" on public.excursion_images for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- announcements
drop policy if exists "announcements read" on public.announcements;
create policy "announcements read" on public.announcements for select
  using (
    (select public.is_admin())
    or (
      status = 'published'
      and publish_at <= now()
      and (expires_at is null or expires_at > now())
    )
  );
drop policy if exists "announcements admin insert" on public.announcements;
create policy "announcements admin insert" on public.announcements for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "announcements admin update" on public.announcements;
create policy "announcements admin update" on public.announcements for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "announcements admin delete" on public.announcements;
create policy "announcements admin delete" on public.announcements for delete to authenticated
  using ((select public.is_admin()));

-- site_settings
drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read" on public.site_settings for select using (true);
drop policy if exists "site_settings admin update" on public.site_settings;
create policy "site_settings admin update" on public.site_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ============================================================================
-- Storage: public-read "media" bucket, admin-only writes
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media bucket admin insert" on storage.objects;
create policy "media bucket admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));
drop policy if exists "media bucket admin update" on storage.objects;
create policy "media bucket admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
drop policy if exists "media bucket admin delete" on storage.objects;
create policy "media bucket admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
-- Admins need SELECT on objects for upsert/replace; public files are served via
-- the public URL, which does not require a policy.
drop policy if exists "media bucket admin select" on storage.objects;
create policy "media bucket admin select" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
