-- Keep username-based assignments attached to the same account during renames.
begin;
create function public.preserve_staff_followup_ownership() returns trigger
language plpgsql set search_path=public as $$
declare previous_username text;
begin
  if TG_OP='INSERT' then previous_username=NEW.configured_username;
  else previous_username=OLD.username;
  end if;
  if previous_username is not null and (TG_OP='INSERT' or previous_username is distinct from NEW.username) then
    update public.pastoral_followups set owner=NEW.username, updated_by='system:account-rename'
      where lower(owner)=lower(previous_username) and owner is distinct from NEW.username;
  end if;
  return NEW;
end $$;
revoke all on function public.preserve_staff_followup_ownership() from public,anon,authenticated;
create trigger preserve_staff_followup_ownership after insert or update of username on public.staff_accounts
for each row execute function public.preserve_staff_followup_ownership();
commit;
