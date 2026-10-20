begin;
create table public.bulk_sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by text not null,
  sent_by text,
  fellowship text,
  message text not null check (length(btrim(message)) between 1 and 1600),
  sender text not null check (length(sender) between 1 and 11),
  recipients jsonb not null check (jsonb_typeof(recipients) = 'array'),
  recipient_count integer not null check (recipient_count > 0 and recipient_count = jsonb_array_length(recipients)),
  segments integer not null check (segments > 0),
  encoding text not null check (encoding in ('GSM-7', 'Unicode')),
  missing_phone integer not null default 0 check (missing_phone >= 0),
  duplicate_phone integer not null default 0 check (duplicate_phone >= 0),
  status text not null default 'draft' check (status in ('draft','ready','sending','completed','uncertain')),
  next_offset integer not null default 0 check (next_offset between 0 and recipient_count),
  accepted integer not null default 0 check (accepted >= 0),
  rejected integer not null default 0 check (rejected >= 0),
  uncertain integer not null default 0 check (uncertain >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accepted + rejected + uncertain + skipped = next_offset)
);
create index bulk_sms_campaigns_created_at_idx on public.bulk_sms_campaigns (created_at desc, id desc);
alter table public.bulk_sms_campaigns enable row level security;
revoke all on public.bulk_sms_campaigns from public, anon, authenticated;
grant select, insert, update on public.bulk_sms_campaigns to service_role;
commit;
