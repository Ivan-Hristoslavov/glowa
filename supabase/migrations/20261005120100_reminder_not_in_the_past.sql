-- A reminder whose time has already passed is not sent.
--
-- A booking made less than a day ahead (the default reminder lead) used to
-- queue its reminder for a moment in the past, so the customer got the
-- confirmation and a "reminder" within the same minute. The confirmation
-- already says when the visit is; the reminder is for bookings made further out.
CREATE OR REPLACE FUNCTION app.appointment_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_locale text;
  v_lead integer;
  v_reminder_at timestamptz;
begin
  if new.is_demo or new.source = 'import' then
    return new;
  end if;

  if new.customer_profile_id is null and new.customer_email is null then
    return new;
  end if;

  v_locale := app.appointment_locale(new.customer_profile_id, new.business_id);

  v_lead := coalesce(
    (select cp.reminder_lead_minutes from public.customer_preferences cp
      where cp.profile_id = new.customer_profile_id),
    1440
  );
  v_reminder_at := new.starts_at - make_interval(mins => v_lead);

  if tg_op = 'INSERT' then
    if new.status in ('pending', 'confirmed') and new.deposit_status <> 'awaiting' then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'booking_confirmation',
        v_locale, 'booking_confirmation:' || new.id::text, now()
      );

      if v_reminder_at > now() then
        perform app.enqueue_notification(
          new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
          'reminder:' || new.id::text || ':'
            || extract(epoch from new.starts_at)::bigint::text,
          v_reminder_at
        );
      end if;
    end if;
    return new;
  end if;

  -- The deposit landed: now the booking is real, and now it is confirmed.
  if old.deposit_status = 'awaiting'
    and new.deposit_status in ('paid', 'waived')
    and new.status in ('pending', 'confirmed')
  then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'booking_confirmation',
      v_locale, 'booking_confirmation:' || new.id::text, now()
    );

    if v_reminder_at > now() then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
        'reminder:' || new.id::text || ':'
          || extract(epoch from new.starts_at)::bigint::text,
        v_reminder_at
      );
    end if;
    return new;
  end if;

  -- Never secured, so never confirmed: nothing to take back.
  if old.deposit_status = 'awaiting' and new.status is distinct from old.status then
    return new;
  end if;

  if new.status is distinct from old.status
    and new.status not in ('pending', 'confirmed')
  then
    update public.notification_deliveries
    set status = 'skipped', error = 'superseded'
    where appointment_id = new.id
      and event_type = 'reminder'
      and status = 'queued';
  elsif new.starts_at is distinct from old.starts_at then
    update public.notification_deliveries
    set status = 'skipped', error = 'superseded'
    where appointment_id = new.id
      and event_type = 'reminder'
      and status = 'queued'
      and idempotency_key <> 'reminder:' || new.id::text || ':'
        || extract(epoch from new.starts_at)::bigint::text;
  end if;

  if new.status is distinct from old.status and new.status = 'cancelled' then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'cancellation',
      v_locale, 'cancellation:' || new.id::text, now()
    );
    return new;
  end if;

  if new.status is distinct from old.status and new.status = 'completed' then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'review_request',
      v_locale, 'review_request:' || new.id::text,
      coalesce(new.completed_at, now()) + interval '3 hours'
    );
    return new;
  end if;

  if new.starts_at is distinct from old.starts_at
    and new.status in ('pending', 'confirmed')
  then
    perform app.enqueue_notification(
      new.business_id, new.id, new.customer_profile_id, 'reschedule', v_locale,
      'reschedule:' || new.id::text || ':'
        || extract(epoch from new.starts_at)::bigint::text,
      now()
    );

    if v_reminder_at > now() then
      perform app.enqueue_notification(
        new.business_id, new.id, new.customer_profile_id, 'reminder', v_locale,
        'reminder:' || new.id::text || ':'
          || extract(epoch from new.starts_at)::bigint::text,
        v_reminder_at
      );
    end if;
  end if;

  return new;
end;
$function$;
