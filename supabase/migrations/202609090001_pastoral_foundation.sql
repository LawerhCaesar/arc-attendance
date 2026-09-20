-- Additive pastoral-care foundation. Existing `members` and `attendance` tables
-- remain untouched so this can be deployed before a deliberate data backfill.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'pastor', 'attendance', 'fellowship_leader')),
  fellowship_scope text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fellowships (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  preferred_name text,
  phone text,
  normalized_phone text,
  email text,
  birth_date date,
  birth_day smallint check (birth_day between 1 and 31),
  birth_month smallint check (birth_month between 1 and 12),
  location text,
  fellowship_id uuid references public.fellowships(id) on delete set null,
  designation text not null default 'Member',
  lifecycle_status text not null default 'visitor'
    check (lifecycle_status in ('visitor', 'regular', 'member', 'inactive')),
  first_visit_at date,
  joined_at date,
  is_active boolean not null default true,
  contact_consent boolean not null default false,
  notes text,
  legacy_member_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists people_normalized_phone_unique
  on public.people(normalized_phone)
  where normalized_phone is not null and normalized_phone <> '';
create index if not exists people_fellowship_idx on public.people(fellowship_id);
create index if not exists people_birthday_idx on public.people(birth_month, birth_day);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  name text not null default 'Sunday Service',
  service_type text not null default 'sunday',
  starts_at timestamptz,
  status text not null default 'open' check (status in ('planned', 'open', 'closed', 'cancelled')),
  closed_at timestamptz,
  created_by uuid references public.app_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_date, name)
);

create index if not exists services_date_idx on public.services(service_date desc);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'excused')),
  is_first_visit boolean not null default false,
  marked_by uuid references public.app_profiles(id) on delete set null,
  marked_at timestamptz not null default now(),
  source text not null default 'manual',
  legacy_attendance_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, service_id)
);

create index if not exists attendance_service_idx on public.attendance_records(service_id, status);
create index if not exists attendance_person_idx on public.attendance_records(person_id, service_id);

create table if not exists public.visitor_journeys (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.people(id) on delete cascade,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'invited_back', 'returned', 'fellowship_assigned', 'member', 'closed')),
  owner_id uuid references public.app_profiles(id) on delete set null,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visitor_journeys_stage_idx
  on public.visitor_journeys(stage, next_follow_up_at);

create table if not exists public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  task_type text not null
    check (task_type in ('absence_follow_up', 'first_timer_follow_up', 'birthday', 'pastoral_care', 'data_quality')),
  title text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'dismissed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references public.app_profiles(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.app_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_tasks_queue_idx
  on public.care_tasks(status, due_at, priority);
create index if not exists care_tasks_person_idx on public.care_tasks(person_id);

create table if not exists public.pastoral_interactions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  care_task_id uuid references public.care_tasks(id) on delete set null,
  interaction_type text not null
    check (interaction_type in ('call', 'message', 'visit', 'prayer', 'conversation', 'note')),
  summary text not null,
  outcome text,
  next_action_at timestamptz,
  recorded_by uuid references public.app_profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pastoral_interactions_person_idx
  on public.pastoral_interactions(person_id, occurred_at desc);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.app_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_entity_idx
  on public.audit_events(entity_type, entity_id, created_at desc);

drop trigger if exists app_profiles_updated_at on public.app_profiles;
create trigger app_profiles_updated_at before update on public.app_profiles
for each row execute function public.set_updated_at();
drop trigger if exists fellowships_updated_at on public.fellowships;
create trigger fellowships_updated_at before update on public.fellowships
for each row execute function public.set_updated_at();
drop trigger if exists people_updated_at on public.people;
create trigger people_updated_at before update on public.people
for each row execute function public.set_updated_at();
drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();
drop trigger if exists attendance_records_updated_at on public.attendance_records;
create trigger attendance_records_updated_at before update on public.attendance_records
for each row execute function public.set_updated_at();
drop trigger if exists visitor_journeys_updated_at on public.visitor_journeys;
create trigger visitor_journeys_updated_at before update on public.visitor_journeys
for each row execute function public.set_updated_at();
drop trigger if exists care_tasks_updated_at on public.care_tasks;
create trigger care_tasks_updated_at before update on public.care_tasks
for each row execute function public.set_updated_at();

insert into public.fellowships (name)
values
  ('All Grace'), ('Parakletos'), ('Special Dunamis'), ('Katalambano'),
  ('Pleroma'), ('Young and Ready'), ('Tsalach'), ('Menorah'),
  ('Enthroned'), ('Mega'), ('Professionals')
on conflict (name) do nothing;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_profiles where id = auth.uid() and is_active = true;
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

alter table public.app_profiles enable row level security;
alter table public.fellowships enable row level security;
alter table public.people enable row level security;
alter table public.services enable row level security;
alter table public.attendance_records enable row level security;
alter table public.visitor_journeys enable row level security;
alter table public.care_tasks enable row level security;
alter table public.pastoral_interactions enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles can read own profile" on public.app_profiles
for select to authenticated using (id = auth.uid() or public.current_app_role() in ('admin', 'pastor'));
create policy "admins manage profiles" on public.app_profiles
for all to authenticated using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "authenticated staff read fellowships" on public.fellowships
for select to authenticated using (public.current_app_role() is not null);
create policy "admins manage fellowships" on public.fellowships
for all to authenticated using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "pastoral staff read people" on public.people
for select to authenticated using (public.current_app_role() in ('admin', 'pastor', 'attendance', 'fellowship_leader'));
create policy "pastors manage people" on public.people
for all to authenticated using (public.current_app_role() in ('admin', 'pastor'))
with check (public.current_app_role() in ('admin', 'pastor'));

create policy "staff read services" on public.services
for select to authenticated using (public.current_app_role() is not null);
create policy "pastors manage services" on public.services
for all to authenticated using (public.current_app_role() in ('admin', 'pastor'))
with check (public.current_app_role() in ('admin', 'pastor'));

create policy "staff read attendance" on public.attendance_records
for select to authenticated using (public.current_app_role() is not null);
create policy "staff mark attendance" on public.attendance_records
for insert to authenticated with check (public.current_app_role() in ('admin', 'pastor', 'attendance', 'fellowship_leader'));
create policy "staff correct attendance" on public.attendance_records
for update to authenticated using (public.current_app_role() in ('admin', 'pastor', 'attendance', 'fellowship_leader'))
with check (public.current_app_role() in ('admin', 'pastor', 'attendance', 'fellowship_leader'));

create policy "pastoral staff manage visitor journeys" on public.visitor_journeys
for all to authenticated using (public.current_app_role() in ('admin', 'pastor', 'fellowship_leader'))
with check (public.current_app_role() in ('admin', 'pastor', 'fellowship_leader'));
create policy "pastoral staff manage care tasks" on public.care_tasks
for all to authenticated using (public.current_app_role() in ('admin', 'pastor', 'fellowship_leader'))
with check (public.current_app_role() in ('admin', 'pastor', 'fellowship_leader'));
create policy "pastoral staff manage interactions" on public.pastoral_interactions
for all to authenticated using (public.current_app_role() in ('admin', 'pastor', 'fellowship_leader'))
with check (public.current_app_role() in ('admin', 'pastor', 'fellowship_leader'));

create policy "admins read audit events" on public.audit_events
for select to authenticated using (public.current_app_role() = 'admin');
create policy "staff append audit events" on public.audit_events
for insert to authenticated with check (public.current_app_role() is not null);
