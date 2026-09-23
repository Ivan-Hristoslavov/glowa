-- ---------------------------------------------------------------------------
-- GLOWA · 0023 · a waitlist needs an event type of its own
--
-- Added on its own because Postgres refuses to use a new enum value in the
-- same transaction that created it. The table and the trigger that emit it
-- follow in 0024.
-- ---------------------------------------------------------------------------

alter type public.notification_event add value if not exists 'waitlist_offer';
