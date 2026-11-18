-- ============================================================================
-- OurWay — primary experience category
-- Applied after 0001–0005. Safe to re-run. Changes no existing data.
--
-- Every experience belongs to one format category:
--   day_trip  → Ημερήσιες Εκδρομές / Day Trips
--   two_day   → Διήμερες Εκδρομές  / Two-Day Trips
--   package   → Πακέτα             / Packages
--
-- This is the trip FORMAT, not the activity type. The older free-text
-- category_el / category_en columns (e.g. "Πεζοπορία") stay as they are and
-- are shown as "Είδος δραστηριότητας".
--
-- The column is nullable so existing rows stay valid: an experience without a
-- category still appears under "All experiences". The admin form asks for a
-- category before an excursion is published.
--
-- Apply this BEFORE deploying the code that reads/writes primary_category.
-- Undo (only if needed): alter table public.excursions drop column primary_category;
-- ============================================================================

alter table public.excursions
  add column if not exists primary_category text;

do $$ begin
  alter table public.excursions add constraint excursions_primary_category_check
    check (primary_category in ('day_trip', 'two_day', 'package'));
exception when duplicate_object then null; end $$;

create index if not exists excursions_primary_category_idx
  on public.excursions (primary_category, status);
