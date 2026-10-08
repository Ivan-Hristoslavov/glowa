-- A booking that arrived through the partner API (a salon's own website).
-- Kept in its own migration: a new enum value cannot be used in the
-- transaction that adds it.
alter type public.appointment_source add value if not exists 'api';
