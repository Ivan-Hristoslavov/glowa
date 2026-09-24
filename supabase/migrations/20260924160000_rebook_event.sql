-- ---------------------------------------------------------------------------
-- GLOWA · rebook invitations, part 1: the event
--
-- `alter type ... add value` cannot be used by the transaction that adds it,
-- so the value lands in a migration of its own, as the waitlist's did.
-- ---------------------------------------------------------------------------

alter type public.notification_event add value if not exists 'rebook_nudge';
