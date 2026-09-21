-- ---------------------------------------------------------------------------
-- GLOWA · 0009 · execute grants for helpers used inside CHECK constraints
--
-- `revoke all on all functions in schema app from public` in migration 0004
-- also stripped EXECUTE from the two pure helpers that CHECK constraints call
-- at write time. Unlike a trigger function (whose EXECUTE is checked when the
-- trigger is created), a constraint function is checked as the writing role,
-- so every insert into `services` or `appointments` failed with
-- "permission denied for function is_localized_text".
--
-- Both take a value and return a value; they read no data.
-- ---------------------------------------------------------------------------

grant execute on function app.is_localized_text(jsonb) to anon, authenticated, service_role;
grant execute on function app.try_uuid(text) to anon, authenticated, service_role;
grant execute on function app.set_updated_at() to anon, authenticated, service_role;
