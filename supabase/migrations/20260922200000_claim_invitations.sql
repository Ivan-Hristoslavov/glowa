-- ---------------------------------------------------------------------------
-- GLOWA · 0015 · make staff invitations actually arrive
--
-- `inviteMember` wrote a `business_members` row with `invited_email` and
-- status 'invited', and nothing ever turned it into access. A manager could
-- invite a colleague, the colleague could sign up, and nothing happened.
--
-- This closes the loop: a signed-in user claims any invitation addressed to
-- their own verified email. The match is on `auth.users.email` read inside a
-- SECURITY DEFINER function, never on an email supplied by the caller, so
-- claiming someone else's invitation is not expressible.
-- ---------------------------------------------------------------------------

create or replace function public.claim_pending_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_claimed integer := 0;
  v_row record;
  v_display_name text;
begin
  if v_uid is null then
    return 0;
  end if;

  -- The caller's own address, from auth - not from anything they passed in.
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    return 0;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), split_part(v_email, '@', 1))
  into v_display_name
  from public.profiles p where p.id = v_uid;

  for v_row in
    select bm.id, bm.business_id, bm.role
    from public.business_members bm
    where bm.status = 'invited'
      and bm.profile_id is null
      and lower(bm.invited_email) = v_email
      -- Never hand someone a second membership in a business they are in.
      and not exists (
        select 1 from public.business_members existing
        where existing.business_id = bm.business_id
          and existing.profile_id = v_uid
      )
  loop
    update public.business_members
    set profile_id = v_uid, status = 'active'
    where id = v_row.id;

    -- Give them a presence on the calendar, but not a bookable one: a manager
    -- decides whether this person takes appointments.
    insert into public.staff_profiles (business_id, member_id, display_name, is_bookable, sort_order)
    select v_row.business_id, v_row.id, v_display_name, false,
           coalesce((select max(sp.sort_order) + 1 from public.staff_profiles sp
                     where sp.business_id = v_row.business_id), 1)
    where not exists (
      select 1 from public.staff_profiles sp where sp.member_id = v_row.id
    );

    insert into public.audit_logs (business_id, actor_profile_id, action, entity_type, entity_id)
    values (v_row.business_id, v_uid, 'member.invitation_claimed', 'business_member', v_row.id::text);

    v_claimed := v_claimed + 1;
  end loop;

  return v_claimed;
end;
$$;

revoke execute on function public.claim_pending_invitations() from public, anon;
grant execute on function public.claim_pending_invitations() to authenticated;

-- An invitation is addressed to one person; two rows for the same address in
-- the same business is a mistake, not a feature.
create unique index if not exists business_members_unique_invite_idx
  on public.business_members (business_id, lower(invited_email))
  where profile_id is null and invited_email is not null;
