-- Preserve legacy duplicates for review, but reject every new conflicting save.
begin;
lock table public.members in share row exclusive mode;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- Keep this normalization in sync with normalizeDuplicatePhone in TypeScript.
create function app_private.member_phone_key(value text) returns text
language plpgsql immutable parallel safe set search_path='' as $$
declare compact text; digits text; international boolean;
begin
  compact=regexp_replace(coalesce(value,''),'^[[:space:]]+|[[:space:]]+$','','g');
  if left(compact,1)=chr(39) then compact=substr(compact,2); end if;
  compact=regexp_replace(compact,'[[:space:]().-]','','g');
  if compact !~ '^[+]?[0-9]+$' then return null; end if;
  international=left(compact,1)='+' or left(compact,2)='00';
  digits=case when left(compact,1)='+' then substr(compact,2)
    when left(compact,2)='00' then substr(compact,3) else compact end;
  if not international then
    if digits ~ '^0[1-9][0-9]{8}$' then return '233'||substr(digits,2); end if;
    if digits ~ '^[1-9][0-9]{8}$' then return '233'||digits; end if;
  end if;
  if left(digits,3)='233' then
    return case when digits ~ '^2330?[1-9][0-9]{8}$' then '233'||right(digits,9) else null end;
  end if;
  return case when (international and digits ~ '^[1-9][0-9]{7,14}$')
    or (not international and digits ~ '^[1-9][0-9]{9,14}$') then digits else null end;
end $$;

-- The primary-key row serializes competing claims, including concurrent writes.
-- Arrays retain existing conflicts without deleting or choosing a member.
create table app_private.member_phone_registry (
  phone_key text primary key,
  member_ids uuid[] not null,
  check(array_position(member_ids,null) is null)
);
alter table app_private.member_phone_registry enable row level security;
revoke all on app_private.member_phone_registry from public, anon, authenticated;
insert into app_private.member_phone_registry(phone_key,member_ids)
select app_private.member_phone_key(phone), array_agg(id order by id)
from public.members where is_active and app_private.member_phone_key(phone) is not null
group by app_private.member_phone_key(phone);

-- Trigger-only privileged functions keep phone claims inaccessible to clients.
create function app_private.sync_member_phone_registry() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_key text; new_key text;
begin
  if TG_OP<>'INSERT' then
    if OLD.is_active then old_key=app_private.member_phone_key(OLD.phone); end if;
  end if;
  if TG_OP<>'DELETE' then
    if NEW.is_active then new_key=app_private.member_phone_key(NEW.phone); end if;
  end if;
  if old_key is not null and old_key is distinct from new_key then
    update app_private.member_phone_registry set member_ids=array_remove(member_ids,OLD.id)
      where phone_key=old_key;
  end if;
  if new_key is not null and old_key is distinct from new_key then
    insert into app_private.member_phone_registry as registry(phone_key,member_ids)
      values(new_key,array[NEW.id])
      on conflict(phone_key) do update set member_ids=array_append(registry.member_ids,NEW.id)
      where not (NEW.id=any(registry.member_ids));
  end if;
  return null;
end $$;

create function app_private.check_member_phone_unique() returns trigger
language plpgsql security definer set search_path='' as $$
declare current_key text; owners uuid[];
begin
  select app_private.member_phone_key(phone) into current_key from public.members
    where id=NEW.id and is_active;
  if current_key is not null then
    select member_ids into owners from app_private.member_phone_registry
      where phone_key=current_key for update;
    if owners is distinct from array[NEW.id] then
      raise exception using errcode='23505', constraint='members_active_phone_unique',
        message='This phone number is already used by another active member. Use a different number or review the existing record.';
    end if;
  end if;
  return null;
end $$;

create function app_private.reset_member_phone_registry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from app_private.member_phone_registry;
  return null;
end $$;
revoke all on all functions in schema app_private from public, anon, authenticated;
create trigger a_sync_member_phone_registry after insert or update or delete on public.members
  for each row execute function app_private.sync_member_phone_registry();
-- Deferred validation lets an approved merge retire all secondaries atomically.
create constraint trigger members_active_phone_unique after insert or update on public.members
  deferrable initially deferred for each row execute function app_private.check_member_phone_unique();
create trigger reset_member_phone_registry after truncate on public.members
  for each statement execute function app_private.reset_member_phone_registry();
commit;
