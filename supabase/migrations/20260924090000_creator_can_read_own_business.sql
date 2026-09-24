-- ---------------------------------------------------------------------------
-- GLOWA · 0026 · a creator can read the business they just created
--
-- Onboarding never worked. `create_business` does
-- `insert into public.businesses ... returning * into v_business`, and
-- `RETURNING` requires the new row to pass the SELECT policy as well as the
-- INSERT one. That policy was:
--
--     status = 'active' OR app.is_business_member(id)
--
-- A new business is created as `draft`, and the owner's membership row is
-- written by an AFTER INSERT trigger that has not fired yet when `RETURNING`
-- is evaluated. So for that instant the row is invisible to the person
-- creating it, Postgres reports "new row violates row-level security policy",
-- and the whole RPC aborts.
--
-- It was never caught because the demo salons are seeded with their
-- memberships in the same statement, so nobody had gone through the real
-- signup path end to end.
--
-- The fix is the missing case rather than a wider grant: whoever created a
-- business can read it. That is true immediately, needs no trigger to have
-- run, and does not expose anything - `created_by` is already forced to the
-- caller by the INSERT policy.
-- ---------------------------------------------------------------------------

drop policy "businesses_select_public_or_member" on public.businesses;

create policy "businesses_select_public_or_member" on public.businesses
  for select to authenticated, anon
  using (
    status = 'active'
    or app.is_business_member(id)
    -- The row is readable to its creator from the moment it exists, which is
    -- what makes `INSERT ... RETURNING` work inside `create_business`.
    or (select auth.uid()) = created_by
  );
