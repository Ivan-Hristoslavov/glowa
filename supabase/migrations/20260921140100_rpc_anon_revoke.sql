-- ---------------------------------------------------------------------------
-- GLOWA · 0011 · finish the RPC lockdown started in 0010
--
-- 0010 revoked EXECUTE from PUBLIC, which was not enough: Supabase ships
-- `alter default privileges in schema public grant all on functions to anon,
-- authenticated, service_role`, so every function created here carries an
-- explicit `anon=X` grant rather than inheriting PUBLIC. Verified with
-- `select proacl from pg_proc` - `anon=X/postgres` was present on all five.
--
-- Revoke from `anon` by name, and stop the default privilege from re-opening
-- future functions. From here on, a function that should be public must say so.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.book_appointment(uuid, timestamptz, uuid, uuid, text),
  public.cancel_appointment(uuid, text),
  public.reschedule_appointment(uuid, timestamptz, uuid)
from anon;

alter default privileges in schema public revoke all on functions from anon;
