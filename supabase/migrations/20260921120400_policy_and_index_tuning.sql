-- ---------------------------------------------------------------------------
-- GLOWA · 0005 · advisor follow-up
--   1. A `for all` write policy also counts as a second permissive SELECT
--      policy, so every read paid for the manager check twice. Split the
--      write policies into insert/update/delete.
--   2. Merge the two overlapping review UPDATE policies into one.
--   3. Cover the foreign keys that are joined or cascade-deleted.
-- ---------------------------------------------------------------------------

-- --- 1. split "for all" write policies -------------------------------------

drop policy "business_members_write_admin" on public.business_members;
create policy "business_members_insert_admin" on public.business_members
  for insert to authenticated with check (app.is_business_admin(business_id));
create policy "business_members_update_admin" on public.business_members
  for update to authenticated
  using (app.is_business_admin(business_id)) with check (app.is_business_admin(business_id));
create policy "business_members_delete_admin" on public.business_members
  for delete to authenticated using (app.is_business_admin(business_id));

drop policy "locations_write_manager" on public.locations;
create policy "locations_insert_manager" on public.locations
  for insert to authenticated with check (app.is_business_manager(business_id));
create policy "locations_update_manager" on public.locations
  for update to authenticated
  using (app.is_business_manager(business_id)) with check (app.is_business_manager(business_id));
create policy "locations_delete_manager" on public.locations
  for delete to authenticated using (app.is_business_manager(business_id));

drop policy "business_hours_write_manager" on public.business_hours;
create policy "business_hours_insert_manager" on public.business_hours
  for insert to authenticated
  with check (app.is_business_manager(app.business_of_location(location_id)));
create policy "business_hours_update_manager" on public.business_hours
  for update to authenticated
  using (app.is_business_manager(app.business_of_location(location_id)))
  with check (app.is_business_manager(app.business_of_location(location_id)));
create policy "business_hours_delete_manager" on public.business_hours
  for delete to authenticated
  using (app.is_business_manager(app.business_of_location(location_id)));

drop policy "staff_profiles_write_manager" on public.staff_profiles;
create policy "staff_profiles_insert_manager" on public.staff_profiles
  for insert to authenticated with check (app.is_business_manager(business_id));
create policy "staff_profiles_update_manager" on public.staff_profiles
  for update to authenticated
  using (app.is_business_manager(business_id)) with check (app.is_business_manager(business_id));
create policy "staff_profiles_delete_manager" on public.staff_profiles
  for delete to authenticated using (app.is_business_manager(business_id));

drop policy "staff_working_hours_write_manager" on public.staff_working_hours;
create policy "staff_working_hours_insert_manager" on public.staff_working_hours
  for insert to authenticated
  with check (app.is_business_manager(app.business_of_staff(staff_profile_id)));
create policy "staff_working_hours_update_manager" on public.staff_working_hours
  for update to authenticated
  using (app.is_business_manager(app.business_of_staff(staff_profile_id)))
  with check (app.is_business_manager(app.business_of_staff(staff_profile_id)));
create policy "staff_working_hours_delete_manager" on public.staff_working_hours
  for delete to authenticated
  using (app.is_business_manager(app.business_of_staff(staff_profile_id)));

drop policy "staff_time_off_write_manager" on public.staff_time_off;
create policy "staff_time_off_insert_manager" on public.staff_time_off
  for insert to authenticated
  with check (app.is_business_manager(app.business_of_staff(staff_profile_id)));
create policy "staff_time_off_update_manager" on public.staff_time_off
  for update to authenticated
  using (app.is_business_manager(app.business_of_staff(staff_profile_id)))
  with check (app.is_business_manager(app.business_of_staff(staff_profile_id)));
create policy "staff_time_off_delete_manager" on public.staff_time_off
  for delete to authenticated
  using (app.is_business_manager(app.business_of_staff(staff_profile_id)));

drop policy "services_write_manager" on public.services;
create policy "services_insert_manager" on public.services
  for insert to authenticated with check (app.is_business_manager(business_id));
create policy "services_update_manager" on public.services
  for update to authenticated
  using (app.is_business_manager(business_id)) with check (app.is_business_manager(business_id));
create policy "services_delete_manager" on public.services
  for delete to authenticated using (app.is_business_manager(business_id));

drop policy "service_staff_write_manager" on public.service_staff;
create policy "service_staff_insert_manager" on public.service_staff
  for insert to authenticated
  with check (app.is_business_manager(app.business_of_service(service_id)));
create policy "service_staff_delete_manager" on public.service_staff
  for delete to authenticated
  using (app.is_business_manager(app.business_of_service(service_id)));

drop policy "business_clients_write_manager" on public.business_clients;
create policy "business_clients_insert_manager" on public.business_clients
  for insert to authenticated with check (app.is_business_manager(business_id));
create policy "business_clients_update_manager" on public.business_clients
  for update to authenticated
  using (app.is_business_manager(business_id)) with check (app.is_business_manager(business_id));
create policy "business_clients_delete_manager" on public.business_clients
  for delete to authenticated using (app.is_business_manager(business_id));

drop policy "payment_records_write_manager" on public.payment_records;
create policy "payment_records_insert_manager" on public.payment_records
  for insert to authenticated with check (app.is_business_manager(business_id));
create policy "payment_records_update_manager" on public.payment_records
  for update to authenticated
  using (app.is_business_manager(business_id)) with check (app.is_business_manager(business_id));
create policy "payment_records_delete_manager" on public.payment_records
  for delete to authenticated using (app.is_business_manager(business_id));

drop policy "marketing_campaigns_write_manager" on public.marketing_campaigns;
create policy "marketing_campaigns_insert_manager" on public.marketing_campaigns
  for insert to authenticated with check (app.is_business_manager(business_id));
create policy "marketing_campaigns_update_manager" on public.marketing_campaigns
  for update to authenticated
  using (app.is_business_manager(business_id)) with check (app.is_business_manager(business_id));
create policy "marketing_campaigns_delete_manager" on public.marketing_campaigns
  for delete to authenticated using (app.is_business_manager(business_id));

drop policy "marketing_messages_write_manager" on public.marketing_messages;
create policy "marketing_messages_insert_manager" on public.marketing_messages
  for insert to authenticated with check (app.is_business_manager(business_id));
create policy "marketing_messages_update_manager" on public.marketing_messages
  for update to authenticated
  using (app.is_business_manager(business_id)) with check (app.is_business_manager(business_id));
create policy "marketing_messages_delete_manager" on public.marketing_messages
  for delete to authenticated using (app.is_business_manager(business_id));

-- --- 2. one UPDATE policy for reviews --------------------------------------
-- The author edits their review; the business writes its response. Which
-- columns each may touch is enforced by app.enforce_review_edit below.

drop policy "reviews_update_author" on public.reviews;
drop policy "reviews_update_business" on public.reviews;
create policy "reviews_update_author_or_business" on public.reviews
  for update to authenticated
  using (
    author_profile_id = (select auth.uid())
    or app.is_business_manager(business_id)
  )
  with check (
    author_profile_id = (select auth.uid())
    or app.is_business_manager(business_id)
  );

create or replace function app.enforce_review_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_is_author boolean := old.author_profile_id = (select auth.uid());
begin
  if v_is_author then
    -- The author owns the rating and the comment, nothing else.
    new.business_id := old.business_id;
    new.appointment_id := old.appointment_id;
    new.author_profile_id := old.author_profile_id;
    new.status := old.status;
    new.business_response := old.business_response;
    new.responded_at := old.responded_at;
    new.is_demo := old.is_demo;
  else
    -- The business may reply and moderate, but may not rewrite the review.
    new.rating := old.rating;
    new.comment := old.comment;
    new.author_profile_id := old.author_profile_id;
    new.appointment_id := old.appointment_id;
    new.business_id := old.business_id;
    if new.business_response is distinct from old.business_response then
      new.responded_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger reviews_enforce_edit
  before update on public.reviews
  for each row execute function app.enforce_review_edit();

-- --- 3. covering indexes for foreign keys ----------------------------------

create index appointment_status_history_changed_by_idx
  on public.appointment_status_history (changed_by);
create index appointments_created_by_idx on public.appointments (created_by);
create index appointments_location_idx on public.appointments (location_id);
create index appointments_service_idx on public.appointments (service_id);
create index audit_logs_actor_idx on public.audit_logs (actor_profile_id);
create index business_clients_profile_idx on public.business_clients (profile_id);
create index businesses_created_by_idx on public.businesses (created_by);
create index calendar_event_links_appointment_idx
  on public.calendar_event_links (appointment_id);
create index external_calendar_connections_business_idx
  on public.external_calendar_connections (business_id);
create index marketing_campaigns_created_by_idx on public.marketing_campaigns (created_by);
create index marketing_messages_client_idx on public.marketing_messages (business_client_id);
create index marketing_messages_business_idx on public.marketing_messages (business_id);
create index notification_preferences_business_idx
  on public.notification_preferences (business_id);
create index payment_records_profile_idx on public.payment_records (profile_id);
create index review_invitations_business_idx on public.review_invitations (business_id);
create index reviews_author_idx on public.reviews (author_profile_id);
create index reviews_staff_idx on public.reviews (staff_profile_id);
create index staff_working_hours_location_idx on public.staff_working_hours (location_id);
