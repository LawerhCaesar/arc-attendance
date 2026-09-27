-- Managed local staff accounts. Only the server's service role can access these
-- tables; browser Supabase clients cannot read hashes or alter permissions.
begin;
create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null check (length(trim(name)) between 1 and 80),
  permissions text[] not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(permissions) > 0),
  check (permissions <@ array['overview','past-entry','past-sundays','absenteeism','demographics','first-timers','fellowship-services','members','raw-data','welfare','entry','users']::text[]),
  check (not ('users' = any(permissions)) or key = 'admin')
);
create unique index if not exists staff_roles_name_unique on public.staff_roles(lower(name));

insert into public.staff_roles(key,name,permissions,is_system) values
('admin','Administrator',array['overview','past-entry','past-sundays','absenteeism','demographics','first-timers','fellowship-services','members','raw-data','welfare','entry','users'],true),
('pastor','Pastor',array['overview','past-entry','past-sundays','absenteeism','demographics','first-timers','fellowship-services','members','raw-data','welfare','entry'],true),
('attendance','Attendance Staff',array['entry','past-entry'],true),
('fellowship_leader','Fellowship Leader',array['entry'],true),
('welfare','Welfare Department',array['welfare'],true),
('first_timers','First Timers Department',array['first-timers'],true)
on conflict(key) do nothing;

create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  password_hash text not null,
  role_id uuid not null references public.staff_roles(id) on delete restrict,
  fellowship text,
  is_active boolean not null default true,
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.staff_access_audit (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  operation text not null,
  created_at timestamptz not null default now()
);

alter table public.staff_roles enable row level security;
alter table public.staff_accounts enable row level security;
alter table public.staff_access_audit enable row level security;
revoke all on public.staff_roles, public.staff_accounts, public.staff_access_audit from anon, authenticated;
grant all on public.staff_roles, public.staff_accounts, public.staff_access_audit to service_role;

create or replace function public.guard_staff_access_changes() returns trigger
language plpgsql set search_path=public as $$
begin
  if TG_TABLE_NAME = 'staff_roles' and TG_OP <> 'INSERT' then
    if OLD.is_system then raise exception 'Built-in roles are protected; create a custom role instead'; end if;
    if TG_OP = 'UPDATE' and (NEW.is_system or NEW.key <> OLD.key) then raise exception 'Role identity cannot be changed'; end if;
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
      if NEW.password_hash<>OLD.password_hash or NEW.role_id<>OLD.role_id or NEW.is_active<>OLD.is_active or NEW.fellowship is distinct from OLD.fellowship then
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
drop trigger if exists guard_staff_roles on public.staff_roles;
create trigger guard_staff_roles before insert or update or delete on public.staff_roles for each row execute function public.guard_staff_access_changes();
drop trigger if exists guard_staff_accounts on public.staff_accounts;
create trigger guard_staff_accounts before insert or update or delete on public.staff_accounts for each row execute function public.guard_staff_access_changes();
commit;
