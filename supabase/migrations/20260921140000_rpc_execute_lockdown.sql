-- ---------------------------------------------------------------------------
-- GLOWA · 0010 · lock down RPC execute privileges
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and `anon`
-- inherits PUBLIC. The explicit grants in 0007/0008 therefore widened nothing:
-- `reschedule_appointment` was reachable from a signed-out request, where its
-- SECURITY DEFINER body would run with the owner's privileges. Its own
-- auth.uid() check still refused the call, but the surface should not exist.
--
-- Revoke from PUBLIC first, then grant only the roles that should call each one.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.book_appointment(uuid, timestamptz, uuid, uuid, text),
  public.cancel_appointment(uuid, text),
  public.reschedule_appointment(uuid, timestamptz, uuid),
  public.search_businesses(text, public.business_category, text, integer, integer),
  public.get_available_slots(uuid, date, date, uuid, uuid)
from public;

-- Writing an appointment always requires a session.
grant execute on function
  public.book_appointment(uuid, timestamptz, uuid, uuid, text),
  public.cancel_appointment(uuid, text),
  public.reschedule_appointment(uuid, timestamptz, uuid)
to authenticated;

-- Discovery and availability are deliberately public: a visitor has to be able
-- to browse salons and see free times before creating an account.
-- `get_available_slots` stays SECURITY DEFINER because it must subtract staff
-- time off, which customers cannot read, and it returns nothing but slot
-- boundaries for an active service at an active business.
grant execute on function
  public.search_businesses(text, public.business_category, text, integer, integer),
  public.get_available_slots(uuid, date, date, uuid, uuid)
to anon, authenticated;
