-- Department-level access and durable notification delivery history.

alter table public.app_profiles
  drop constraint if exists app_profiles_role_check;
alter table public.app_profiles
  add constraint app_profiles_role_check
  check (role in ('admin', 'pastor', 'attendance', 'fellowship_leader', 'welfare', 'first_timers'));

drop policy if exists "pastoral staff manage visitor journeys" on public.visitor_journeys;
create policy "pastoral and first timer staff manage visitor journeys" on public.visitor_journeys
for all to authenticated
using (public.current_app_role() in ('admin', 'pastor', 'first_timers'))
with check (public.current_app_role() in ('admin', 'pastor', 'first_timers'));

drop policy if exists "pastoral staff manage care tasks" on public.care_tasks;
create policy "department staff manage scoped care tasks" on public.care_tasks
for all to authenticated
using (
  public.current_app_role() in ('admin', 'pastor') or
  (public.current_app_role() = 'welfare' and task_type in ('birthday', 'pastoral_care')) or
  (public.current_app_role() = 'first_timers' and task_type = 'first_timer_follow_up')
)
with check (
  public.current_app_role() in ('admin', 'pastor') or
  (public.current_app_role() = 'welfare' and task_type in ('birthday', 'pastoral_care')) or
  (public.current_app_role() = 'first_timers' and task_type = 'first_timer_follow_up')
);

drop policy if exists "pastoral staff manage interactions" on public.pastoral_interactions;
create policy "department staff manage pastoral interactions" on public.pastoral_interactions
for all to authenticated
using (public.current_app_role() in ('admin', 'pastor', 'welfare', 'first_timers'))
with check (public.current_app_role() in ('admin', 'pastor', 'welfare', 'first_timers'));

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  person_key text not null,
  recipient text not null,
  scheduled_for date not null,
  provider_message_id text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  unique (notification_type, person_key, recipient, scheduled_for)
);

alter table public.notification_deliveries enable row level security;
create policy "admins read notification deliveries" on public.notification_deliveries
for select to authenticated using (public.current_app_role() = 'admin');
