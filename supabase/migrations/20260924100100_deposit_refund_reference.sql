-- ---------------------------------------------------------------------------
-- GLOWA · 0029 · an empty refund reference means "none"
--
-- `complete_deposit_refund` is sometimes called without a Stripe refund id -
-- the refund already existed at Stripe, or Stripe refused it - and the typed
-- client has no way to send SQL null for a required text argument. An empty
-- string now means "keep what is there" instead of overwriting it with ''.
-- ---------------------------------------------------------------------------

create or replace function public.complete_deposit_refund(
  p_refund_id uuid,
  p_provider_reference text,
  p_succeeded boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment_id uuid;
begin
  update public.payment_records
  set status = case when p_succeeded then 'succeeded'::public.payment_status
                    else 'failed'::public.payment_status end,
      provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference),
      failure_reason = case when p_succeeded then null else left(p_error, 500) end
  where id = p_refund_id
    and kind = 'refund'
  returning appointment_id into v_appointment_id;

  if p_succeeded and v_appointment_id is not null then
    perform set_config('app.trusted_write', 'on', true);
    update public.appointments
    set deposit_status = 'refunded'
    where id = v_appointment_id
      and deposit_status = 'refund_pending';
    perform set_config('app.trusted_write', 'off', true);
  end if;
end;
$$;

revoke execute on function public.complete_deposit_refund(uuid, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.complete_deposit_refund(uuid, text, boolean, text)
  to service_role;
