-- ---------------------------------------------------------------------------
-- GLOWA · 0006 · take the Data API away from `anon` except where it is needed
--
-- Supabase's default privileges hand `anon` full DML on new public tables.
-- RLS was already denying those rows, but a signed-out request should not even
-- reach the table: reduce the surface to the eight relations that genuinely
-- back public discovery, read-only.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant select on
  public.businesses, public.locations, public.business_hours,
  public.staff_profiles, public.staff_working_hours, public.services,
  public.service_staff, public.reviews
to anon;

-- Newly created tables must not silently re-open to anon.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
