-- Operational follow-ups for the current staff-account system. No confidential
-- counselling notes. The browser cannot access these tables directly.
begin;
-- Add an assignable, least-privilege tab without changing any existing role.
do $$ declare constraint_name text; begin
  for constraint_name in select conname from pg_constraint
    where conrelid='public.staff_roles'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%permissions <@%'
  loop execute format('alter table public.staff_roles drop constraint %I', constraint_name); end loop;
end $$;
alter table public.staff_roles add constraint staff_roles_allowed_permissions
  check(permissions <@ array['overview','care','past-entry','past-sundays','absenteeism','demographics','first-timers','fellowship-services','members','raw-data','welfare','entry','users']::text[]);
create table if not exists public.pastoral_followups (
  id uuid primary key default gen_random_uuid(),
  person_ref text not null check(length(person_ref) between 1 and 500),
  name text not null check(length(name) between 1 and 200),
  phone text not null default '',
  fellowship text not null default '',
  category text not null check(category in ('absence','visitor','birthday')),
  reason text not null,
  owner text not null check(length(owner) between 1 and 100),
  due_date date not null,
  priority text not null default 'normal' check(priority in ('normal','high')),
  status text not null default 'open' check(status in ('open','in_progress','completed','dismissed')),
  outcome text not null default '' check(length(outcome) <= 1000),
  created_by text not null,
  updated_by text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pastoral_followups_one_open on public.pastoral_followups(person_ref, category)
  where status in ('open','in_progress');
create index if not exists pastoral_followups_due on public.pastoral_followups(status,due_date);
create table if not exists public.pastoral_followup_audit (
  id bigint generated always as identity primary key,
  task_id uuid not null,
  actor text not null,
  action text not null,
  previous_status text,
  status text not null,
  owner text not null,
  due_date date not null,
  occurred_at timestamptz not null default now()
);
create or replace function public.audit_pastoral_followup() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then NEW.updated_at = clock_timestamp(); end if;
  insert into public.pastoral_followup_audit(task_id,actor,action,previous_status,status,owner,due_date)
    values(NEW.id,NEW.updated_by,TG_OP,case when TG_OP='UPDATE' then OLD.status else null end,NEW.status,NEW.owner,NEW.due_date);
  return NEW;
end; $$;
revoke all on function public.audit_pastoral_followup() from public;
drop trigger if exists pastoral_followups_audit on public.pastoral_followups;
create trigger pastoral_followups_audit before insert or update on public.pastoral_followups
  for each row execute function public.audit_pastoral_followup();
alter table public.pastoral_followups enable row level security;
alter table public.pastoral_followup_audit enable row level security;
revoke all on public.pastoral_followups,public.pastoral_followup_audit from anon,authenticated;
grant all on public.pastoral_followups,public.pastoral_followup_audit to service_role;
grant usage,select on sequence public.pastoral_followup_audit_id_seq to service_role;
commit;
