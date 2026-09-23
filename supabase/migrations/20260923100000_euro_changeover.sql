-- ---------------------------------------------------------------------------
-- GLOWA · 0019 · Bulgaria is on the euro
--
-- The lev is gone, so BGN stops being the default and every amount already in
-- the database is redenominated.
--
-- The conversion uses the official irrevocably fixed rate, 1 EUR = 1.95583
-- BGN, and rounds to the nearest cent. That is the legal rule for converting
-- an existing obligation, and it is why this is arithmetic rather than a
-- repricing: nobody gets to round a client's agreed price up in the process.
-- A salon that wants tidier numbers re-prices its own services afterwards.
--
-- Amounts on other currencies (RON for the Romanian market) are untouched.
-- ---------------------------------------------------------------------------

-- The fixed rate, kept as a function so the arithmetic below cannot drift
-- between statements.
create or replace function app.bgn_to_eur_cents(p_cents bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select round(p_cents / 1.95583)::bigint;
$$;

-- --- defaults --------------------------------------------------------------

alter table public.businesses alter column currency set default 'EUR';
alter table public.services alter column currency set default 'EUR';
alter table public.appointments alter column currency set default 'EUR';
alter table public.payment_records alter column currency set default 'EUR';

-- --- existing rows ---------------------------------------------------------

-- The guard triggers treat the migration owner as "not a member" and would
-- refuse these writes.
select set_config('app.trusted_write', 'on', true);

update public.services
set price_cents = app.bgn_to_eur_cents(price_cents)::integer,
    currency = 'EUR'
where currency = 'BGN';

-- An appointment's price is a snapshot of what was agreed. Redenominating it
-- keeps that agreement intact in the new unit; leaving it in BGN would make
-- the history unreadable once the column default says otherwise.
update public.appointments
set price_cents = app.bgn_to_eur_cents(price_cents)::integer,
    currency = 'EUR'
where currency = 'BGN';

update public.payment_records
set amount_cents = app.bgn_to_eur_cents(amount_cents)::integer,
    currency = 'EUR'
where currency = 'BGN';

-- The CRM's running total is a sum of converted amounts, so it converts too.
-- Scoped by the business's own currency, and done before the businesses are
-- switched, so a RON business's clients are left alone.
update public.business_clients bc
set total_spend_cents = app.bgn_to_eur_cents(bc.total_spend_cents)
from public.businesses b
where b.id = bc.business_id
  and b.currency = 'BGN'
  and bc.total_spend_cents > 0;

update public.businesses
set currency = 'EUR'
where currency = 'BGN';

-- --- demo data -------------------------------------------------------------

-- Converting 60.00 BGN gives 30.68 EUR, which is arithmetically right and
-- looks like nothing a salon would ever put on a price list. Real businesses
-- re-round their own prices after a changeover; the seeded demo salons are
-- re-rounded here so the showcase reads like a price list rather than a
-- conversion table. Only `is_demo` rows are touched - a real business's prices
-- are its own decision.
update public.services s
set price_cents = greatest(500, (round(s.price_cents / 500.0) * 500)::integer)
from public.businesses b
where b.id = s.business_id and b.is_demo;

-- Keep the demo appointments' snapshots consistent with the demo price list.
update public.appointments a
set price_cents = s.price_cents
from public.services s, public.businesses b
where s.id = a.service_id and b.id = a.business_id and b.is_demo;
