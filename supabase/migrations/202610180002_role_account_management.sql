-- Editable built-in permissions, username changes, and managed overrides for
-- configured staff logins. The base administrator remains a recovery account.
begin;
alter table public.staff_accounts add column configured_username text;
create unique index staff_accounts_configured_username_unique on public.staff_accounts(configured_username);
alter table public.staff_accounts add constraint staff_accounts_configured_username_normalized
  check(configured_username is null or (configured_username = lower(btrim(configured_username)) and length(configured_username) > 0));

create or replace function public.guard_staff_access_changes() returns trigger
language plpgsql set search_path=public as $$
begin
  if TG_TABLE_NAME = 'staff_roles' and TG_OP <> 'INSERT' then
    if TG_OP = 'DELETE' and OLD.is_system then raise exception 'Built-in roles cannot be deleted'; end if;
    if TG_OP = 'UPDATE' then
      if NEW.is_system is distinct from OLD.is_system or NEW.key <> OLD.key then raise exception 'Role identity cannot be changed'; end if;
      if NEW.key = 'admin' and not ('users' = any(NEW.permissions)) then raise exception 'Administrator must retain Users & Roles access'; end if;
      if NEW.key = 'fellowship_leader' and NEW.permissions <> array['members']::text[] then raise exception 'Fellowship leaders are restricted to their fellowship roster'; end if;
    end if;
  end if;
  if TG_TABLE_NAME = 'staff_accounts' and TG_OP <> 'INSERT' then
    perform pg_advisory_xact_lock(729270003);
    if OLD.is_active and exists(select 1 from staff_roles where id=OLD.role_id and key='admin') then
      if TG_OP='DELETE' or not NEW.is_active or NEW.role_id <> OLD.role_id then
        if not exists(select 1 from staff_accounts a join staff_roles r on r.id=a.role_id where a.id<>OLD.id and a.is_active and r.key='admin') then
          raise exception 'The last managed administrator cannot be deactivated or demoted';
        end if;
      end if;
    end if;
    if TG_OP='UPDATE' then
      if NEW.configured_username is distinct from OLD.configured_username then raise exception 'Configured account identity cannot be changed'; end if;
      if NEW.password_hash<>OLD.password_hash or NEW.username<>OLD.username or NEW.role_id<>OLD.role_id or NEW.is_active<>OLD.is_active or NEW.fellowship is distinct from OLD.fellowship then
        NEW.session_version := OLD.session_version + 1;
      else NEW.session_version := OLD.session_version;
      end if;
    end if;
  end if;
  insert into staff_access_audit(table_name,record_id,operation) values(TG_TABLE_NAME,case when TG_OP='DELETE' then OLD.id else NEW.id end,TG_OP);
  if TG_OP='DELETE' then return OLD; end if;
  NEW.updated_at := now();
  return NEW;
end $$;
commit;
