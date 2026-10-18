-- Optional email sign-in for existing accounts. New active leader accounts
-- require an email in the application; existing leaders can be completed there.
begin;
alter table public.staff_accounts add column email text;
alter table public.staff_accounts add constraint staff_accounts_email_valid check (
  email is null or (email = lower(btrim(email)) and length(email) <= 254
    and length(split_part(email, '@', 1)) <= 64
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
create unique index staff_accounts_email_unique on public.staff_accounts(email) where email is not null;

-- Runs after guard_staff_accounts; changing an email revokes the same sessions
-- as a username/password edit without double-incrementing the version.
create function public.revoke_staff_email_sessions() returns trigger
language plpgsql set search_path=public as $$
begin
  NEW.session_version := OLD.session_version + 1;
  return NEW;
end $$;
revoke all on function public.revoke_staff_email_sessions() from public, anon, authenticated;
create trigger revoke_staff_email_sessions before update on public.staff_accounts
for each row when (OLD.email is distinct from NEW.email)
execute function public.revoke_staff_email_sessions();

-- Delivery history contains staff email addresses and is server-only.
revoke all on public.notification_deliveries from anon, authenticated;
grant all on public.notification_deliveries to service_role;
commit;
