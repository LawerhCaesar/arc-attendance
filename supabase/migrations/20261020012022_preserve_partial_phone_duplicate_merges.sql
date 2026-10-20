-- A reviewed merge may reduce a legacy group in several steps. The protected
-- merge audit must prove this transaction retired a record sharing the primary's
-- unchanged number. Ordinary saves and new conflicting members still fail.
begin;
create or replace function app_private.check_member_phone_unique() returns trigger
language plpgsql security definer set search_path='' as $$
declare current_key text; owners uuid[]; reduced_by_merge boolean;
begin
  select app_private.member_phone_key(phone) into current_key from public.members
    where id=NEW.id and is_active;
  if current_key is not null then
    select member_ids into owners from app_private.member_phone_registry
      where phone_key=current_key for update;
    if owners is distinct from array[NEW.id] then
      select exists(
        select 1 from public.member_merge_events event
        where event.primary_member_id=NEW.id and event.xmin=pg_current_xact_id()::xid
          and NEW.id=any(owners)
          and exists(select 1 from jsonb_array_elements(event.members_before) member
            where member->>'id'=NEW.id::text and app_private.member_phone_key(member->>'phone')=current_key)
          and exists(select 1 from jsonb_array_elements(event.members_before) member
            where member->>'id'<>NEW.id::text and member->>'is_active'='true'
              and app_private.member_phone_key(member->>'phone')=current_key
              and not ((member->>'id')::uuid=any(owners)))
      ) into reduced_by_merge;
      if not reduced_by_merge then
        raise exception using errcode='23505', constraint='members_active_phone_unique',
          message='This phone number is already used by another active member. Use a different number or review the existing record.';
      end if;
    end if;
  end if;
  return null;
end $$;
revoke all on function app_private.check_member_phone_unique() from public, anon, authenticated;
commit;
