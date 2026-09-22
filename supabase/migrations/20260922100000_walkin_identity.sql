-- ---------------------------------------------------------------------------
-- GLOWA · 0013 · a walk-in can be identified by name alone
--
-- `appointments_identified_customer` accepted a profile, an email or a phone.
-- That is right for a self-service booking, but wrong at the front desk: a
-- salon writing down "Иван, 14:00" has a name and nothing else, and the insert
-- failed a check constraint the UI could only report as a generic error.
--
-- Admit `customer_name` as an identifier. The customer-side guard trigger still
-- sets `customer_profile_id` from auth.uid() for every self-service booking,
-- so this does not let an anonymous booking through the public flow.
-- ---------------------------------------------------------------------------

alter table public.appointments
  drop constraint appointments_identified_customer;

alter table public.appointments
  add constraint appointments_identified_customer
  check (
    customer_profile_id is not null
    or nullif(btrim(coalesce(customer_name, '')), '') is not null
    or customer_email is not null
    or customer_phone is not null
  );
