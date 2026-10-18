-- One email namespace for managed accounts and configured recovery logins.
begin;
create table public.staff_account_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid unique references public.staff_accounts(id) on delete cascade,
  configured_username text unique,
  email text unique,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(account_id, configured_username) = 1),
  check (configured_username is null or (configured_username = lower(btrim(configured_username)) and length(configured_username) > 0)),
  check (email is null or (email = lower(btrim(email)) and length(email) <= 254
    and length(split_part(email, '@', 1)) <= 64
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
);
alter table public.staff_account_contacts enable row level security;
revoke all on public.staff_account_contacts from anon, authenticated;
grant all on public.staff_account_contacts to service_role;

insert into public.staff_account_contacts(account_id,email)
select id,email from public.staff_accounts;

create function public.sync_staff_contact_email() returns trigger
language plpgsql set search_path=public as $$
begin
  -- Moving a configured login into managed accounts transfers its email claim.
  if NEW.configured_username is not null then
    update staff_account_contacts set account_id=NEW.id, configured_username=null,
      email=NEW.email, updated_at=now() where configured_username=NEW.configured_username;
    if found then return NEW; end if;
  end if;
  insert into staff_account_contacts(account_id,email) values(NEW.id,NEW.email)
    on conflict(account_id) do update set email=EXCLUDED.email,updated_at=now();
  return NEW;
end $$;
revoke all on function public.sync_staff_contact_email() from public, anon, authenticated;
create trigger sync_staff_contact_email after insert or update of email on public.staff_accounts
for each row execute function public.sync_staff_contact_email();
commit;
