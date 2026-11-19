-- ---------------------------------------------------------------------------
-- 0009 — Deposit per person for excursions.
--
-- Adds excursions.deposit_eur next to the existing price_eur (price per person).
-- Additive and re-runnable:
--   * no existing column is changed or dropped;
--   * price_note_el / price_note_en keep every value they hold today — nothing
--     is copied or converted into deposit_eur (the admin sets it explicitly);
--   * the new column starts empty (null) for every excursion.
-- ---------------------------------------------------------------------------

alter table public.excursions
  add column if not exists deposit_eur numeric(10, 2);

-- Never negative, never above the per-person price (when a price is set).
-- Departures with their own price are checked by the admin Server Actions.
alter table public.excursions drop constraint if exists excursions_deposit_valid;
alter table public.excursions
  add constraint excursions_deposit_valid check (
    deposit_eur is null
    or (deposit_eur >= 0 and deposit_eur <= 1000000 and (price_eur is null or deposit_eur <= price_eur))
  );

comment on column public.excursions.deposit_eur is
  'Deposit per person in EUR (informational; no payment is taken online). Null = not shown.';
comment on column public.excursions.price_note_el is
  'Legacy free-text price note. Kept for reference; no longer edited or shown on the website since 0009.';
comment on column public.excursions.price_note_en is
  'Legacy free-text price note. Kept for reference; no longer edited or shown on the website since 0009.';
