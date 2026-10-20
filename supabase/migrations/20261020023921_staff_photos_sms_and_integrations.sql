begin;
alter table public.staff_accounts add column phone text,
  add column birthday_sms_enabled boolean not null default true;
alter table public.staff_accounts add constraint staff_phone_valid check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

create table public.app_integrations (
  provider text primary key check (provider in ('sms_online_gh','google_drive')),
  encrypted_settings text not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);
create table public.profile_photos (
  subject text primary key check (subject ~ '^(member|account):[0-9a-f-]{36}$' or subject ~ '^configured:[a-z0-9._-]{1,64}$'),
  drive_file_id text not null check (drive_file_id ~ '^[a-zA-Z0-9_-]{10,200}$'),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  updated_by text not null,
  updated_at timestamptz not null default now()
);
create table public.birthday_sms_deliveries (
  idempotency_key text primary key,
  member_id uuid not null references public.members(id),
  recipient text not null check (recipient ~ '^\+[1-9][0-9]{7,14}$'),
  scheduled_for date not null,
  notification_type text not null,
  status text not null check (status in ('sending','accepted','failed','uncertain')),
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_integrations enable row level security;
alter table public.profile_photos enable row level security;
alter table public.birthday_sms_deliveries enable row level security;
revoke all on public.app_integrations,public.profile_photos,public.birthday_sms_deliveries from public,anon,authenticated;
grant all on public.app_integrations,public.profile_photos,public.birthday_sms_deliveries to service_role;
commit;
