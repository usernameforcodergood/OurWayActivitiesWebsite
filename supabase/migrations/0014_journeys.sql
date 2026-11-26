-- ---------------------------------------------------------------------------
-- 0014 — «Οι Διαδρομές μας» / "Our Journeys": public archive of trips that
-- really took place. Applied after 0001–0013. Additive and safe to re-run:
-- it creates two new tables and touches no existing row or table.
--
-- Data model:
--   journeys        = one public write-up of one completed run. It POINTS AT the
--                     existing excursion and (optionally) the exact departure it
--                     documents; it is not a second excursion system. Bookings,
--                     payments and the excursion itself are never read or changed.
--   journey_images  = its photo gallery, in order (photos live in the existing
--                     media library / "media" storage bucket).
--
-- Guarantees enforced here:
--   * the departure belongs to the excursion (composite foreign key, as 0011
--     does for bookings), and each departure can be archived at most once;
--   * an excursion / departure that is archived cannot be deleted (restrict);
--   * nothing is published without a title, a date, and the admin's
--     confirmation that identifiable participants consented to their photos;
--   * visitors (anon) can read published entries only; only admins write.
--     The tables hold no personal data of participants or bookings.
-- ---------------------------------------------------------------------------

create table if not exists public.journeys (
  id                      uuid primary key default gen_random_uuid(),
  excursion_id            uuid not null references public.excursions (id) on delete restrict,
  departure_id            uuid,
  slug                    text not null unique
                          check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  status                  public.content_status not null default 'draft',
  cover_media_id          uuid references public.media (id) on delete set null,

  title_el                text check (char_length(title_el) <= 200),
  title_en                text check (char_length(title_en) <= 200),
  summary_el              text check (char_length(summary_el) <= 600),
  summary_en              text check (char_length(summary_en) <= 600),
  description_el          text check (char_length(description_el) <= 50000),  -- editor HTML, sanitised by the app
  description_en          text check (char_length(description_en) <= 50000),
  quote_el                text check (char_length(quote_el) <= 600),           -- optional words from the trip
  quote_en                text check (char_length(quote_en) <= 600),
  location_el             text check (char_length(location_el) <= 200),
  location_en             text check (char_length(location_en) <= 200),

  occurred_on             date not null,
  occurred_until          date,
  photo_consent_confirmed boolean not null default false,

  published_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint journeys_has_title
    check (coalesce(btrim(title_el), '') <> '' or coalesce(btrim(title_en), '') <> ''),
  constraint journeys_dates_order
    check (occurred_until is null or occurred_until >= occurred_on),
  constraint journeys_publish_needs_consent
    check (status <> 'published' or photo_consent_confirmed),
  constraint journeys_departure_same_excursion
    foreign key (departure_id, excursion_id)
    references public.departures (id, excursion_id)
    on delete restrict
);

-- One public entry per run (an excursion without runs may have several, by date).
create unique index if not exists journeys_departure_key
  on public.journeys (departure_id) where departure_id is not null;
create index if not exists journeys_public_idx on public.journeys (status, occurred_on desc);
create index if not exists journeys_excursion_idx on public.journeys (excursion_id);
create index if not exists journeys_cover_idx on public.journeys (cover_media_id);

drop trigger if exists journeys_touch on public.journeys;
create trigger journeys_touch before update on public.journeys
  for each row execute function public.touch_updated_at();

create table if not exists public.journey_images (
  journey_id uuid not null references public.journeys (id) on delete cascade,
  media_id   uuid not null references public.media (id) on delete cascade,
  position   integer not null default 0 check (position >= 0),
  primary key (journey_id, media_id)
);

create index if not exists journey_images_order_idx on public.journey_images (journey_id, position);
create index if not exists journey_images_media_idx on public.journey_images (media_id);

comment on table public.journeys is
  'Public archive ("Our Journeys") of completed runs. Links to excursions/departures; never to bookings.';
comment on column public.journeys.photo_consent_confirmed is
  'Admin confirms that participants recognisable in the photos agreed to publication. Required to publish.';

-- ============================================================================
-- Row Level Security (same rules as excursions / excursion_images)
-- ============================================================================
alter table public.journeys       enable row level security;
alter table public.journey_images enable row level security;

drop policy if exists "journeys read" on public.journeys;
create policy "journeys read" on public.journeys for select
  using (status = 'published' or (select public.is_admin()));
drop policy if exists "journeys admin insert" on public.journeys;
create policy "journeys admin insert" on public.journeys for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "journeys admin update" on public.journeys;
create policy "journeys admin update" on public.journeys for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "journeys admin delete" on public.journeys;
create policy "journeys admin delete" on public.journeys for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "journey_images read" on public.journey_images;
create policy "journey_images read" on public.journey_images for select
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.journeys j
      where j.id = journey_id and j.status = 'published'
    )
  );
drop policy if exists "journey_images admin write" on public.journey_images;
create policy "journey_images admin write" on public.journey_images for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
