-- ============================================================================
-- 0012 — Payment tracking per request (recorded by admins; no online payment).
-- Applied after 0001–0011. Safe to re-run. Keeps every existing record.
--
-- Two different things are kept apart on purpose:
--   * EXPECTED  — what the customer should pay: the agreed total and the
--                 agreed deposit. Stored on the request (bookings).
--   * RECEIVED  — what was actually paid or refunded. One row per movement in
--                 public.booking_payments; never a single editable "paid" field.
-- Paid, refunded, balance and payment status are always calculated from the
-- movements, so they can never drift from them.
--
-- Movements are never edited or deleted from the admin: a mistaken entry is
-- voided (with a reason, who and when) and stays visible in the history.
-- Every write goes through the admin_* functions below, which check the
-- admin, lock the request row and validate the amounts.
--
-- Apply BEFORE deploying the code that uses it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expected amounts (admin overrides; null = use the default)
--    Default total   = total_eur (price snapshot at submission × people)
--    Default deposit = excursions.deposit_eur × people
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists amount_due_eur     numeric(12, 2),
  add column if not exists deposit_due_eur    numeric(12, 2),
  add column if not exists amounts_updated_at timestamptz,
  add column if not exists amounts_updated_by uuid references auth.users (id) on delete set null;

alter table public.bookings drop constraint if exists bookings_amounts_valid;
alter table public.bookings
  add constraint bookings_amounts_valid check (
        (amount_due_eur  is null or amount_due_eur  between 0 and 1000000)
    and (deposit_due_eur is null or deposit_due_eur between 0 and 1000000)
    and (amount_due_eur is null or deposit_due_eur is null or deposit_due_eur <= amount_due_eur)
  );

comment on column public.bookings.amount_due_eur is
  'Agreed total in EUR set by an admin. Null = the submission snapshot (total_eur).';
comment on column public.bookings.deposit_due_eur is
  'Agreed deposit in EUR set by an admin. Null = excursions.deposit_eur × participants.';

-- ---------------------------------------------------------------------------
-- 2. Payment movements
-- ---------------------------------------------------------------------------
create table if not exists public.booking_payments (
  id           bigint generated always as identity primary key,
  booking_id   uuid not null references public.bookings (id) on delete cascade,
  kind         text not null check (kind in ('payment', 'refund')),
  amount_eur   numeric(12, 2) not null check (amount_eur > 0 and amount_eur <= 1000000),
  paid_on      date not null,
  method       text not null check (method in ('cash', 'bank_transfer', 'card', 'iris', 'other')),
  note         text check (char_length(note) <= 500),
  recorded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references auth.users (id) on delete set null,
  void_reason  text check (char_length(void_reason) <= 500),
  constraint booking_payments_void_complete check (
    (voided_at is null and void_reason is null)
    or (voided_at is not null and char_length(btrim(void_reason)) >= 1)
  )
);

create index if not exists booking_payments_booking_idx on public.booking_payments (booking_id, paid_on, id);

alter table public.booking_payments enable row level security;

drop policy if exists "booking_payments admin read" on public.booking_payments;
create policy "booking_payments admin read" on public.booking_payments for select to authenticated
  using ((select public.is_admin()));

-- Reads only; every write goes through the admin_* functions.
revoke all on public.booking_payments from anon;
revoke insert, update, delete, truncate on public.booking_payments from authenticated;
grant select on public.booking_payments to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Totals for one request (non-voided movements only)
-- ---------------------------------------------------------------------------
create or replace function public.booking_paid_totals(p_booking_id uuid, out paid numeric, out refunded numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(amount_eur) filter (where kind = 'payment'), 0),
    coalesce(sum(amount_eur) filter (where kind = 'refund'), 0)
  from public.booking_payments
  where booking_id = p_booking_id and voided_at is null;
$$;
revoke all on function public.booking_paid_totals(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin: record a payment or a refund
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_payment(
  p_booking_id uuid,
  p_kind       text,
  p_amount     numeric,
  p_paid_on    date,
  p_method     text,
  p_note       text default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_totals record;
  v_id     bigint;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Lock the request so two admins cannot refund the same money twice.
  perform 1 from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if p_kind is null or p_kind not in ('payment', 'refund') then
    raise exception 'payment_kind' using errcode = 'P0001';
  end if;
  if p_method is null or p_method not in ('cash', 'bank_transfer', 'card', 'iris', 'other') then
    raise exception 'payment_method' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then
    raise exception 'payment_amount' using errcode = 'P0001';
  end if;
  if p_paid_on is null
     or p_paid_on > (now() at time zone 'Europe/Athens')::date
     or p_paid_on < date '2020-01-01' then
    raise exception 'payment_date' using errcode = 'P0001';
  end if;

  if p_kind = 'refund' then
    select * into v_totals from public.booking_paid_totals(p_booking_id);
    if p_amount > v_totals.paid - v_totals.refunded then
      raise exception 'refund_exceeds:%', greatest(v_totals.paid - v_totals.refunded, 0) using errcode = 'P0001';
    end if;
  end if;

  insert into public.booking_payments (booking_id, kind, amount_eur, paid_on, method, note, recorded_by)
  values (p_booking_id, p_kind, p_amount, p_paid_on, p_method, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.admin_record_payment(uuid, text, numeric, date, text, text) from public, anon;
grant execute on function public.admin_record_payment(uuid, text, numeric, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin: void a mistaken movement (kept in history, excluded from totals)
-- ---------------------------------------------------------------------------
create or replace function public.admin_void_payment(p_payment_id bigint, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_p      public.booking_payments%rowtype;
  v_totals record;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 1 or char_length(p_reason) > 500 then
    raise exception 'void_reason' using errcode = 'P0001';
  end if;

  select * into v_p from public.booking_payments where id = p_payment_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- Same lock order as admin_record_payment: request first, then the movement.
  perform 1 from public.bookings where id = v_p.booking_id for update;
  select * into v_p from public.booking_payments where id = p_payment_id for update;
  if v_p.voided_at is not null then
    raise exception 'already_voided' using errcode = 'P0001';
  end if;

  -- Voiding a payment must not leave more refunded than paid.
  if v_p.kind = 'payment' then
    select * into v_totals from public.booking_paid_totals(v_p.booking_id);
    if v_totals.paid - v_p.amount_eur < v_totals.refunded then
      raise exception 'void_breaks_refunds' using errcode = 'P0001';
    end if;
  end if;

  update public.booking_payments
  set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = p_payment_id;
end;
$$;
revoke all on function public.admin_void_payment(bigint, text) from public, anon;
grant execute on function public.admin_void_payment(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Admin: set the agreed total / deposit (null = back to the default)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_booking_amounts(p_booking_id uuid, p_amount_due numeric, p_deposit_due numeric)
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
  if (p_amount_due is not null and (p_amount_due < 0 or p_amount_due > 1000000 or p_amount_due <> round(p_amount_due, 2)))
     or (p_deposit_due is not null and (p_deposit_due < 0 or p_deposit_due > 1000000 or p_deposit_due <> round(p_deposit_due, 2))) then
    raise exception 'payment_amount' using errcode = 'P0001';
  end if;
  if p_amount_due is not null and p_deposit_due is not null and p_deposit_due > p_amount_due then
    raise exception 'deposit_above_total' using errcode = 'P0001';
  end if;

  update public.bookings
  set amount_due_eur = p_amount_due,
      deposit_due_eur = p_deposit_due,
      amounts_updated_at = now(),
      amounts_updated_by = auth.uid()
  where id = p_booking_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.admin_set_booking_amounts(uuid, numeric, numeric) from public, anon;
grant execute on function public.admin_set_booking_amounts(uuid, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Admin list view: same columns as 0011, plus the money columns at the end
--
--   expected_total_eur   agreed total, else the submission snapshot
--   expected_deposit_eur agreed deposit, else excursion deposit × people
--                        (never above the expected total)
--   paid_eur / refunded_eur / net_paid_eur   from non-voided movements
--   balance_eur          expected_total − net_paid (negative = paid extra)
--   payment_status       unpaid | partial | deposit_paid | paid | refunded
--   payment_open         money still owed on a committed request:
--                          scheduled request → confirmed or completed;
--                          general inquiry   → only once an admin set an
--                                              agreed total (amount_due_eur)
--   refund_due           money held for a rejected / cancelled request
-- ---------------------------------------------------------------------------
create or replace view public.booking_overview with (security_invoker = true) as
select
  b.id, b.reference, b.kind, b.status, b.excursion_id, b.departure_id,
  b.first_name, b.last_name, b.first_name || ' ' || b.last_name as full_name,
  b.email, b.phone, b.participants, b.unit_price_eur, b.total_eur, b.locale,
  b.hold_expires_at, b.status_changed_at, b.created_at,
  d.departure_date, d.departure_time,
  e.title_el as excursion_title_el, e.title_en as excursion_title_en, e.slug as excursion_slug, e.kind as excursion_kind,
  b.preferred_period,
  d.return_date, d.status as departure_status,
  b.message, b.special_requests,
  -- 0012
  b.amount_due_eur, b.deposit_due_eur,
  x.expected_total as expected_total_eur,
  x.expected_deposit as expected_deposit_eur,
  pay.paid as paid_eur,
  pay.refunded as refunded_eur,
  pay.paid - pay.refunded as net_paid_eur,
  x.expected_total - (pay.paid - pay.refunded) as balance_eur,
  case
    when pay.paid = 0 then 'unpaid'
    when pay.paid - pay.refunded <= 0 then 'refunded'
    when x.expected_total is not null and pay.paid - pay.refunded >= x.expected_total then 'paid'
    when x.expected_deposit > 0 and pay.paid - pay.refunded >= x.expected_deposit then 'deposit_paid'
    else 'partial'
  end as payment_status,
  (
    x.expected_total is not null
    and pay.paid - pay.refunded < x.expected_total
    and case when b.kind = 'booking' then b.status in ('confirmed', 'completed')
             else b.amount_due_eur is not null end
  ) as payment_open,
  (
    pay.paid - pay.refunded > 0
    and b.kind = 'booking'
    and b.status in ('rejected', 'cancelled')
  ) as refund_due
from public.bookings b
join public.excursions e on e.id = b.excursion_id
left join public.departures d on d.id = b.departure_id
cross join lateral (
  select
    coalesce(sum(p.amount_eur) filter (where p.kind = 'payment'), 0)::numeric(12, 2) as paid,
    coalesce(sum(p.amount_eur) filter (where p.kind = 'refund'), 0)::numeric(12, 2) as refunded
  from public.booking_payments p
  where p.booking_id = b.id and p.voided_at is null
) pay
cross join lateral (
  select
    coalesce(b.amount_due_eur, b.total_eur)::numeric(12, 2) as expected_total,
    (case
       when coalesce(b.deposit_due_eur, e.deposit_eur * b.participants) is null then null
       when coalesce(b.amount_due_eur, b.total_eur) is null then coalesce(b.deposit_due_eur, e.deposit_eur * b.participants)
       else least(coalesce(b.deposit_due_eur, e.deposit_eur * b.participants), coalesce(b.amount_due_eur, b.total_eur))
     end)::numeric(12, 2) as expected_deposit
) x;

revoke all on public.booking_overview from anon;
grant select on public.booking_overview to authenticated;
